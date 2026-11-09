#!/usr/bin/env python3
"""Serve the offline joseki site, revalidating cached files on each visit."""

import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class RevalidatingHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Applies to index pages, versioned URLs, and 304 responses alike.
        # Unchanged files can still use the browser's cached response body.
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", nargs="?", type=int, default=8000)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--directory", default=str(Path(__file__).resolve().parent))
    args = parser.parse_args()
    handler = partial(RevalidatingHandler, directory=args.directory)
    with ThreadingHTTPServer((args.bind, args.port), handler) as server:
        print(f"Serving {args.directory} on {args.bind}:{server.server_port}", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
