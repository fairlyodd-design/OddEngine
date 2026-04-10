const http = require("node:http");

function createBridgeServer({ port = 45777, onEvent, getRecentEvents }) {
  const recentEvents = [];
  let server = null;

  function remember(event) {
    recentEvents.unshift({
      receivedAt: new Date().toISOString(),
      ...event
    });
    if (recentEvents.length > 25) recentEvents.length = 25;
  }

  function json(response, statusCode, payload) {
    response.writeHead(statusCode, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    response.end(JSON.stringify(payload));
  }

  server = http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://127.0.0.1:${port}`);

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      json(response, 200, {
        ok: true,
        app: "homie_companion",
        port,
        recentEventCount: recentEvents.length
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/events/recent") {
      json(response, 200, {
        ok: true,
        events: getRecentEvents ? getRecentEvents() : recentEvents
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/event") {
      let body = "";
      request.on("data", (chunk) => { body += chunk.toString("utf8"); });
      request.on("end", () => {
        try {
          const event = body ? JSON.parse(body) : {};
          remember(event);
          if (onEvent) onEvent(event);
          json(response, 200, { ok: true, event });
        } catch (error) {
          json(response, 400, { ok: false, error: String(error?.message || error) });
        }
      });
      return;
    }

    json(response, 404, { ok: false, error: "Not found" });
  });

  function listen() {
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, "127.0.0.1", () => resolve({ port }));
    });
  }

  function close() {
    return new Promise((resolve) => {
      if (!server) return resolve();
      server.close(() => resolve());
    });
  }

  return {
    listen,
    close,
    getRecentEvents: () => [...recentEvents]
  };
}

module.exports = {
  createBridgeServer
};
