#!/usr/bin/env python3
"""Validate vs-mobile-build targets without performing any build operations."""

import argparse
import json


class Once(argparse.Action):
    def __call__(self, parser, namespace, values, option_string=None):
        if getattr(namespace, self.dest) is not None:
            parser.error(f"{option_string} must not be repeated")
        setattr(namespace, self.dest, True if self.nargs == 0 else values)


def main():
    parser = argparse.ArgumentParser(
        prog="vs-mobile-build",
        description="Select iOS, Android, or both; validation only, no build side effects.",
        allow_abbrev=False,
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "-t", choices=("ios", "android", "andorid"), action=Once,
        help="single platform (andorid is accepted as an alias for android)",
    )
    group.add_argument("-a", action=Once, nargs=0, help="build both platforms")
    args = parser.parse_args()
    targets = ["ios", "android"] if args.a else [
        "android" if args.t == "andorid" else args.t
    ]
    print(json.dumps({"targets": targets}))


if __name__ == "__main__":
    main()
