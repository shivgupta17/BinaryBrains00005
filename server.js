const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT_LIST = [3000, 3001, 8080, 8081, 5000];
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*'
      });
      res.end('<h1>404 Not Found</h1><p>The requested page or resource could not be found.</p>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer((req, res) => {
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') {
    reqUrl = '/index.html';
  }

  // Prevent directory traversal attacks
  const safePath = path.normalize(reqUrl).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  serveFile(req, res, filePath);
});

function tryListen(portIndex) {
  if (portIndex >= PORT_LIST.length) {
    console.error('Could not find an available port to start the server.');
    process.exit(1);
  }

  const port = PORT_LIST[portIndex];
  server.listen(port, '0.0.0.0', () => {
    console.log('\n======================================================');
    console.log(`🏥 GramCare AI Server is Live!`);
    console.log(`👉 Access URL:  http://localhost:${port}`);
    console.log(`👉 Local Net:   http://127.0.0.1:${port}`);
    console.log('======================================================\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} is busy, trying next port...`);
      tryListen(portIndex + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

tryListen(0);
