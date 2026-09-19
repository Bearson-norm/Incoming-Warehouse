import { IsString, IsArray, IsNumber } from 'class-validator';

export class GatewayHelloDto {
  @IsString()
  gatewayId: string;

  @IsString()
  hostname: string;

  @IsString()
  appVersion: string;

  @IsArray()
  @IsString({ each: true })
  capabilities: string[];

  @IsNumber()
  ts: number;
}
