#!/usr/bin/env python3
"""GitHub Actions launcher: create exactly one Vultr render VM and report its ID/IP."""
import json
import os
import sys
import urllib.error
import urllib.request

API = "https://api.vultr.com/v2"


def request(method, path, body=None):
    headers = {"Authorization": "Bearer " + os.environ["VULTR_API_KEY"],
               "Content-Type": "application/json"}
    payload = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=payload, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return json.loads(resp.read()) if resp.status != 204 else {}
    except urllib.error.HTTPError as exc:
        print(f"Vultr API {method} {path}: HTTP {exc.code}: {exc.read().decode()[:400]}", file=sys.stderr)
        raise SystemExit(1)


def main():
    action = sys.argv[1]
    if action == "launch":
        label = "cc-ftl-cloud-render"
        existing = request("GET", "/instances?label=" + label).get("instances", [])
        if existing:
            raise SystemExit("A cc-ftl-cloud-render instance already exists; refusing duplicate billing.")
        payload = {"region": os.environ["VULTR_REGION"],
                   "plan": os.environ["VULTR_PLAN"],
                   "os_id": int(os.environ["VULTR_OS_ID"]),
                   "sshkey_id": [os.environ["VULTR_SSH_KEY_ID"]],
                   "label": label, "hostname": "cc-ftl-render"}
        obj = request("POST", "/instances", payload)["instance"]
        instance_id = obj["id"]
        with open(os.environ["GITHUB_OUTPUT"], "a") as out:
            out.write(f"instance_id={instance_id}\n")
        print(f"Created Vultr render instance {instance_id}. Charges begin now.")
    elif action == "ip":
        obj = request("GET", "/instances/" + os.environ["INSTANCE_ID"])["instance"]
        ip = obj.get("main_ip", "")
        if not ip or ip == "0.0.0.0":
            raise SystemExit("Server public IP is not yet ready.")
        with open(os.environ["GITHUB_OUTPUT"], "a") as out:
            out.write(f"ip={ip}\n")
        print("Server IPv4:", ip)
    else:
        raise SystemExit("Expected launch or ip")


if __name__ == "__main__":
    main()
