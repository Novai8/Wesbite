"""CDP helper for AliExpress research — connects to user's running Chrome.

Usage: python -I scripts/cdp_research.py
Interactive driver is separate; this module exposes helpers.
"""
import json
import sys
import time

import websocket

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PORT_FILE = r"C:\Users\minec\AppData\Local\Google\Chrome\User Data\DevToolsActivePort"


def read_ws_path():
    with open(PORT_FILE, "r") as f:
        lines = f.read().strip().split("\n")
    return lines[1].strip()


class CDP:
    def __init__(self):
        path = read_ws_path()
        self.ws = websocket.create_connection(
            "ws://127.0.0.1:9222" + path, timeout=30
        )
        self.msg_id = 0
        self.sessions = {}

    def send(self, method, params=None, session_id=None):
        self.msg_id += 1
        msg = {"id": self.msg_id, "method": method, "params": params or {}}
        if session_id:
            msg["sessionId"] = session_id
        self.ws.send(json.dumps(msg))
        deadline = time.time() + 30
        while time.time() < deadline:
            raw = self.ws.recv()
            data = json.loads(raw)
            if data.get("id") == self.msg_id:
                if "error" in data:
                    raise RuntimeError(f"{method}: {data['error']}")
                return data.get("result", {})
            # ignore events
        raise TimeoutError(method)

    def get_pages(self):
        res = self.send("Target.getTargets")
        return [t for t in res["targetInfos"] if t["type"] == "page"]

    def new_tab(self, url="about:blank"):
        res = self.send("Target.createTarget", {"url": url})
        return res["targetId"]

    def attach(self, target_id):
        res = self.send(
            "Target.attachToTarget", {"targetId": target_id, "flatten": True}
        )
        sid = res["sessionId"]
        self.sessions[target_id] = sid
        return sid

    def eval(self, sid, expression):
        res = self.send(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
            session_id=sid,
        )
        if "exceptionDetails" in res:
            raise RuntimeError(res["exceptionDetails"].get("exception", {}).get("description", "js error"))
        return res.get("result", {}).get("value")

    def navigate(self, sid, url):
        self.send("Page.enable", session_id=sid)
        self.send("Page.navigate", {"url": url}, session_id=sid)

    def screenshot(self, sid, path):
        import base64
        res = self.send("Page.captureScreenshot", {"format": "png"}, session_id=sid)
        with open(path, "wb") as f:
            f.write(base64.b64decode(res["data"]))

    def close(self):
        self.ws.close()
