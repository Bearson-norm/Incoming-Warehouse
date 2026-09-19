import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as url from 'url';

interface SerialConfig {
  port: string;
  baudRate: number;
  parity: 'none' | 'even' | 'odd';
  dataBits: 5 | 6 | 7 | 8;
  stopBits: 1 | 1.5 | 2;
  autoDetect?: boolean;
}

interface ServerConfig {
  url: string;
  apiKey: string;
}

interface StableConfig {
  windowMs: number;
  pattern: string;
  unstablePattern: string;
}

interface Config {
  serial: SerialConfig;
  server: ServerConfig;
  stable: StableConfig;
}

export class ConfigServer {
  private server: http.Server | null = null;
  private port: number;
  private configPath: string;
  private getConfig: () => Config;
  private reloadConfig: () => void;
  private apiKey: string;

  constructor(
    port: number,
    configPath: string,
    getConfig: () => Config,
    reloadConfig: () => void,
    apiKey?: string,
  ) {
    this.port = port;
    this.configPath = configPath;
    this.getConfig = getConfig;
    this.reloadConfig = reloadConfig;
    this.apiKey = (apiKey || process.env.GATEWAY_API_KEY || '').trim();
  }

  start() {
    this.server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url || '/', true);
      const pathname = parsedUrl.pathname;

      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4124');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Gateway-Key');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      const isApi = pathname?.startsWith('/api/');
      if (isApi && !this.isAuthorized(req)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      if (pathname === '/' || pathname === '/index.html') {
        this.serveHTML(res);
      } else if (pathname === '/api/config' && req.method === 'GET') {
        this.getConfigAPI(res);
      } else if (pathname === '/api/config' && req.method === 'POST') {
        this.saveConfigAPI(req, res);
      } else if (pathname === '/api/serial-ports' && req.method === 'GET') {
        this.getSerialPortsAPI(res);
      } else if (pathname === '/favicon.ico') {
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`Config UI available at: http://127.0.0.1:${this.port}`);
    });
  }

  private isAuthorized(req: http.IncomingMessage): boolean {
    if (!this.apiKey) {
      return false;
    }
    const provided = String(req.headers['x-gateway-key'] || '');
    return provided === this.apiKey;
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  private serveHTML(res: http.ServerResponse) {
    const html = this.getHTML();
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  private getConfigAPI(res: http.ServerResponse) {
    try {
      const config = this.getConfig();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(config, null, 2));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  private async saveConfigAPI(req: http.IncomingMessage, res: http.ServerResponse) {
    try {
      const body = await this.readBody(req);
      const config = JSON.parse(body);

      // Validate config structure
      if (!config.serial || !config.server || !config.stable) {
        throw new Error('Invalid config structure');
      }

      // Ensure parent directory exists (user home, not Program Files)
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');

      // Reload config in gateway
      this.reloadConfig();

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Config saved successfully' }));
    } catch (error: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  private async getSerialPortsAPI(res: http.ServerResponse) {
    try {
      const { SerialPort } = await import('serialport');
      const ports = await SerialPort.list();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(ports));
    } catch (error: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', reject);
    });
  }

  private getHTML(): string {
    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gateway Configuration</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }

    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }

    .header p {
      opacity: 0.9;
      font-size: 14px;
    }

    .content {
      padding: 30px;
    }

    .section {
      margin-bottom: 30px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 20px;
      background: #f9f9f9;
    }

    .section h2 {
      color: #333;
      margin-bottom: 20px;
      font-size: 20px;
      border-bottom: 2px solid #667eea;
      padding-bottom: 10px;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 500;
      font-size: 14px;
    }

    .form-group input,
    .form-group select {
      width: 100%;
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      transition: border-color 0.3s;
    }

    .form-group input:focus,
    .form-group select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    .form-group small {
      display: block;
      margin-top: 5px;
      color: #777;
      font-size: 12px;
    }

    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .checkbox-group input[type="checkbox"] {
      width: auto;
      cursor: pointer;
    }

    .buttons {
      display: flex;
      gap: 15px;
      margin-top: 30px;
    }

    .btn {
      padding: 14px 28px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      flex: 1;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: #f0f0f0;
      color: #333;
    }

    .btn-secondary:hover {
      background: #e0e0e0;
    }

    .alert {
      padding: 15px;
      border-radius: 6px;
      margin-bottom: 20px;
      display: none;
    }

    .alert-success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .alert-error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .alert.show {
      display: block;
    }

    .loading {
      text-align: center;
      padding: 20px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚙️ Gateway Configuration</h1>
      <p>Configure your weighing gateway settings</p>
    </div>
    <div class="content">
      <div id="alert" class="alert"></div>
      
      <form id="configForm">
        <!-- Serial Configuration -->
        <div class="section">
          <h2>Serial Port Settings</h2>
          
          <div class="form-group">
            <label for="serialPort">Serial Port</label>
            <select id="serialPort" name="serial.port" required>
              <option value="">Loading ports...</option>
            </select>
            <small>Select the COM port where your scale is connected</small>
          </div>

          <div class="form-group">
            <label for="baudRate">Baud Rate</label>
            <select id="baudRate" name="serial.baudRate" required>
              <option value="1200">1200</option>
              <option value="2400">2400</option>
              <option value="4800">4800</option>
              <option value="9600">9600</option>
              <option value="19200">19200</option>
              <option value="38400">38400</option>
              <option value="57600">57600</option>
              <option value="115200">115200</option>
            </select>
          </div>

          <div class="form-group">
            <label for="parity">Parity</label>
            <select id="parity" name="serial.parity" required>
              <option value="none">None</option>
              <option value="even">Even</option>
              <option value="odd">Odd</option>
            </select>
          </div>

          <div class="form-group">
            <label for="dataBits">Data Bits</label>
            <select id="dataBits" name="serial.dataBits" required>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
            </select>
          </div>

          <div class="form-group">
            <label for="stopBits">Stop Bits</label>
            <select id="stopBits" name="serial.stopBits" required>
              <option value="1">1</option>
              <option value="1.5">1.5</option>
              <option value="2">2</option>
            </select>
          </div>

          <div class="form-group">
            <div class="checkbox-group">
              <input type="checkbox" id="autoDetect" name="serial.autoDetect">
              <label for="autoDetect" style="margin: 0;">Auto-detect serial port</label>
            </div>
            <small>Automatically detect and use available serial port</small>
          </div>
        </div>

        <!-- Server Configuration -->
        <div class="section">
          <h2>Server Settings</h2>
          
          <div class="form-group">
            <label for="serverUrl">Server URL</label>
            <input type="url" id="serverUrl" name="server.url" required placeholder="http://localhost:4123">
            <small>The API server URL where data will be sent</small>
          </div>

          <div class="form-group">
            <label for="apiKey">API Key</label>
            <input type="text" id="apiKey" name="server.apiKey" required placeholder="your-gateway-api-key">
            <small>API key for gateway authentication</small>
          </div>
        </div>

        <!-- Stable Detection Settings -->
        <div class="section">
          <h2>Stable Weight Detection</h2>
          
          <div class="form-group">
            <label for="windowMs">Stable Window (ms)</label>
            <input type="number" id="windowMs" name="stable.windowMs" required min="100" max="10000" step="100">
            <small>Time window in milliseconds for stable weight detection</small>
          </div>

          <div class="form-group">
            <label for="pattern">Stable Pattern</label>
            <input type="text" id="pattern" name="stable.pattern" required placeholder="ST|STABLE|S">
            <small>Regex pattern to identify stable weight in serial data</small>
          </div>

          <div class="form-group">
            <label for="unstablePattern">Unstable Pattern</label>
            <input type="text" id="unstablePattern" name="stable.unstablePattern" required placeholder="US|UNSTABLE|U">
            <small>Regex pattern to identify unstable weight in serial data</small>
          </div>
        </div>

        <div class="buttons">
          <button type="button" class="btn btn-secondary" onclick="loadConfig()">Reload</button>
          <button type="submit" class="btn btn-primary">Save Configuration</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // Load serial ports on page load
    async function loadSerialPorts() {
      try {
        const gatewayHeaders = { 'X-Gateway-Key': ${JSON.stringify(this.apiKey)} };
        const response = await fetch('/api/serial-ports', { headers: gatewayHeaders });
        const ports = await response.json();
        const select = document.getElementById('serialPort');
        
        select.innerHTML = '<option value="">Select a port...</option>';
        ports.forEach(port => {
          const option = document.createElement('option');
          option.value = port.path;
          option.textContent = \`\${port.path} - \${port.manufacturer || 'Unknown'}\`;
          select.appendChild(option);
        });
      } catch (error) {
        console.error('Failed to load serial ports:', error);
        const select = document.getElementById('serialPort');
        select.innerHTML = '<option value="">Error loading ports</option>';
      }
    }

    // Load current config
    async function loadConfig() {
      try {
        const gatewayHeaders = { 'X-Gateway-Key': ${JSON.stringify(this.apiKey)} };
        const response = await fetch('/api/config', { headers: gatewayHeaders });
        const config = await response.json();
        
        // Set form values
        document.getElementById('serialPort').value = config.serial?.port || '';
        document.getElementById('baudRate').value = config.serial?.baudRate || 9600;
        document.getElementById('parity').value = config.serial?.parity || 'none';
        document.getElementById('dataBits').value = config.serial?.dataBits || 8;
        document.getElementById('stopBits').value = config.serial?.stopBits || 1;
        document.getElementById('autoDetect').checked = config.serial?.autoDetect ?? true;
        document.getElementById('serverUrl').value = config.server?.url || '';
        document.getElementById('apiKey').value = config.server?.apiKey || '';
        document.getElementById('windowMs').value = config.stable?.windowMs || 1000;
        document.getElementById('pattern').value = config.stable?.pattern || '';
        document.getElementById('unstablePattern').value = config.stable?.unstablePattern || '';
        
        showAlert('Configuration loaded successfully', 'success');
      } catch (error) {
        showAlert('Failed to load configuration: ' + error.message, 'error');
      }
    }

    // Save config
    async function saveConfig(event) {
      event.preventDefault();
      
      const formData = new FormData(event.target);
      const config = {
        serial: {
          port: formData.get('serial.port'),
          baudRate: parseInt(formData.get('serial.baudRate')),
          parity: formData.get('serial.parity'),
          dataBits: parseInt(formData.get('serial.dataBits')),
          stopBits: parseFloat(formData.get('serial.stopBits')),
          autoDetect: document.getElementById('autoDetect').checked,
        },
        server: {
          url: formData.get('server.url'),
          apiKey: formData.get('server.apiKey'),
        },
        stable: {
          windowMs: parseInt(formData.get('stable.windowMs')),
          pattern: formData.get('stable.pattern'),
          unstablePattern: formData.get('stable.unstablePattern'),
        },
      };

      try {
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Key': ${JSON.stringify(this.apiKey)},
          },
          body: JSON.stringify(config),
        });

        const result = await response.json();
        
        if (response.ok) {
          showAlert('Configuration saved successfully! Please restart the gateway for changes to take effect.', 'success');
        } else {
          showAlert('Failed to save: ' + result.error, 'error');
        }
      } catch (error) {
        showAlert('Failed to save configuration: ' + error.message, 'error');
      }
    }

    function showAlert(message, type) {
      const alert = document.getElementById('alert');
      alert.textContent = message;
      alert.className = \`alert alert-\${type} show\`;
      setTimeout(() => {
        alert.classList.remove('show');
      }, 5000);
    }

    // Initialize
    document.getElementById('configForm').addEventListener('submit', saveConfig);
    loadSerialPorts();
    loadConfig();
  </script>
</body>
</html>`;
  }
}
