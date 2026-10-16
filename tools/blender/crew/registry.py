"""Slot item registry. Each item module registers builders with @slot_item(...)."""
from dataclasses import dataclass
from typing import Callable

ITEMS: list["Item"] = []


@dataclass
class Item:
    id: str          # manifest id, e.g. crew.human.hair.mohawk
    slot: str        # runtime slot name, e.g. hair, eyes, arm.L, torso
    name: str        # short item name, also used in node names
    build: Callable  # build(Builder) -> None
    skinned: bool = False


def slot_item(slot, name, sides=None, skinned=False):
    """Register `build(b)`. With sides=('L','R') the function is called per side as build(b, s) with s=+1 (L) / -1 (R),
    producing slots `<slot>.L` and `<slot>.R`."""
    def deco(fn):
        if sides:
            for side, s in zip(("L", "R"), (1, -1)):
                ITEMS.append(Item(f"crew.human.{slot}.{side}.{name}", f"{slot}.{side}", name,
                                  lambda b, fn=fn, s=s, side=side: fn(b, s, side), skinned))
        else:
            ITEMS.append(Item(f"crew.human.{slot}.{name}", slot, name, fn, skinned))
        return fn
    return deco
