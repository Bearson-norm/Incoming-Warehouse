import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { WeightUpdateDto } from '../common/dto/weight-update.dto';
import { GatewayHelloDto } from '../common/dto/gateway-hello.dto';
import { SocketEvents, WeightLivePayload } from '../common/types/socket-events';
import { WeightSnapshotStore } from './weight-snapshot.store';
import { requireSecret } from '../common/runtime-secrets';

interface GatewaySocket extends Socket {
  gatewayId?: string;
  isGateway?: boolean;
  userId?: number;
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  },
  namespace: '/',
})
export class WeighingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WeighingGateway.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private snapshots: WeightSnapshotStore,
  ) {}

  afterInit(server: Server) {
    server.use((socket: GatewaySocket, next) => {
      try {
        const apiKey =
          socket.handshake.auth?.apiKey ||
          (typeof socket.handshake.headers?.authorization === 'string'
            ? socket.handshake.headers.authorization.replace(/^Bearer\s+/i, '')
            : undefined);
        const expectedApiKey = requireSecret(
          'GATEWAY_API_KEY',
          this.configService.get<string>('GATEWAY_API_KEY'),
        );

        if (apiKey && apiKey === expectedApiKey) {
          socket.isGateway = true;
          return next();
        }

        const token = socket.handshake.auth?.token as string | undefined;
        if (!token) {
          return next(new Error('Unauthorized'));
        }

        const payload = this.jwtService.verify(token) as {
          sub: number;
          username: string;
          role: string;
        };
        socket.userId = payload.sub;
        socket.join('dashboard');
        return next();
      } catch {
        return next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(client: GatewaySocket) {
    this.logger.log(
      `Client connected: ${client.id}${client.isGateway ? ' (gateway)' : client.userId ? ` (user ${client.userId})` : ''}`,
    );
  }

  async handleDisconnect(client: GatewaySocket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    if (client.isGateway && client.gatewayId) {
      try {
        await this.prisma.gateway.updateMany({
          where: { gatewayId: client.gatewayId },
          data: { lastSeenAt: new Date() },
        });
      } catch (error) {
        this.logger.warn(
          `Could not update gateway lastSeen (database unavailable): ${(error as Error).message}`,
        );
      }
    }
  }

  @SubscribeMessage(SocketEvents.GATEWAY_HELLO)
  async handleGatewayHello(
    @MessageBody() payload: GatewayHelloDto,
    @ConnectedSocket() client: GatewaySocket,
  ) {
    if (!client.isGateway) {
      client.disconnect();
      return { error: 'Unauthorized' };
    }

    client.gatewayId = payload.gatewayId;

    const apiKey =
      client.handshake.auth?.apiKey ||
      this.configService.get<string>('GATEWAY_API_KEY') ||
      '';

    try {
      await this.prisma.gateway.upsert({
        where: { gatewayId: payload.gatewayId },
        update: {
          lastSeenAt: new Date(),
          version: payload.appVersion,
          os: payload.hostname,
        },
        create: {
          gatewayId: payload.gatewayId,
          name: payload.hostname,
          apiKey,
          version: payload.appVersion,
          os: payload.hostname,
          lastSeenAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Gateway hello OK but DB register failed: ${(error as Error).message}`,
      );
    }

    this.logger.log(`Gateway registered: ${payload.gatewayId}`);
    return { success: true };
  }

  @SubscribeMessage(SocketEvents.WEIGHT_UPDATE)
  async handleWeightUpdate(
    @MessageBody() payload: WeightUpdateDto,
    @ConnectedSocket() client: GatewaySocket,
  ) {
    if (!client.isGateway) {
      return { error: 'Unauthorized' };
    }

    try {
      this.snapshots.set({
        gatewayId: payload.gatewayId,
        readingId: payload.readingId,
        weight: payload.weight,
        unit: payload.unit,
        stable: payload.stable,
        rawLine: payload.rawLine,
        capturedAt: payload.capturedAt,
        ts: Date.now(),
      });

      const livePayload: WeightLivePayload = {
        gatewayId: payload.gatewayId,
        readingId: payload.readingId,
        weight: payload.weight,
        unit: payload.unit,
        stable: payload.stable,
        grossOrNet: payload.grossOrNet,
        rawLine: payload.rawLine,
        capturedAt: payload.capturedAt,
      };

      this.server.to('dashboard').emit(SocketEvents.WEIGHT_LIVE, livePayload);

      client.emit(SocketEvents.WEIGHT_ACK, {
        readingId: payload.readingId,
        persisted: true,
      });

      return { success: true, readingId: payload.readingId, sessionEnded: false };
    } catch (error) {
      this.logger.error(
        `Error handling weight update: ${(error as Error).message}`,
        (error as Error).stack,
      );
      client.emit(SocketEvents.WEIGHT_ACK, {
        readingId: payload.readingId,
        persisted: false,
        error: (error as Error).message,
      });
      return { error: (error as Error).message };
    }
  }
}
