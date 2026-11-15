# Roadmap

Planned feature work, in rough order. No dates: the order changes as the game takes shape. Shipped work moves to the [changelog](../CHANGELOG.md).

## Current goals

These aren't features. They're the aims we use to choose which features to build next.

- **Physical encounters.** Encounters happen with real ships, crew and salvage you can see and act on, not just text outcomes. First, the stubbed outcomes get implemented, then several new encounters are added.
- **Discovery and rewards.** Exploring turns up valuable equipment, unusual resources and useful information.
- **World opportunities.** Better points of interest, more variation between regions, and better information about what's nearby.

## Now

Shipped and no longer listed: physical encounters, the UI consistency pass and prisoners ([#116](https://github.com/BigBadLoser/cc-ftl/issues/116)); see the [changelog](../CHANGELOG.md).

- **Core loop: danger bands and fewer empty hops.** Danger bands across the map and more to find per node, so hops are not dead waiting. Starts with an audit and a design discussion. ([#382](https://github.com/BigBadLoser/cc-ftl/issues/382), [#171](https://github.com/BigBadLoser/cc-ftl/issues/171))
- **Station assembly.** One modular assembly system for station generation; the PR is open. ([#460](https://github.com/BigBadLoser/cc-ftl/issues/460))

## Next

- **Research pass.** ([#380](https://github.com/BigBadLoser/cc-ftl/issues/380))
- **Story arcs.** ([#383](https://github.com/BigBadLoser/cc-ftl/issues/383))
- **Goals after the tutorial.** A rolling captain's log of goals past act 3, with a pull toward deeper space. ([#172](https://github.com/BigBadLoser/cc-ftl/issues/172), [#52](https://github.com/BigBadLoser/cc-ftl/issues/52))
- **A second income and things to spend on.** Another way to earn besides deliveries, and real costs for credits. Needs your design call. ([#174](https://github.com/BigBadLoser/cc-ftl/issues/174))
- **Recruiting prisoners.** Offer captives a place in the crew. ([#492](https://github.com/BigBadLoser/cc-ftl/issues/492))

## Later: major features

Not in order. Ship weapon upgrades and the flak cannon shipped ([#344](https://github.com/BigBadLoser/cc-ftl/pull/344), [#351](https://github.com/BigBadLoser/cc-ftl/pull/351), [#346](https://github.com/BigBadLoser/cc-ftl/pull/346)).

- **More ship weapon types.** Further weapon families beyond flak.
- **Robots you research and build.** Research robot designs and build your own robots.
- **Construction pods.** Build pods that do hull work away from the ship.
- **New species.**

## Later: smaller features

Not in order.

- **Weapons and gear to chase.** Ten crew weapons with art become items you can find, buy and equip. ([#49](https://github.com/BigBadLoser/cc-ftl/issues/49))
- **Vehicles built at their bays.** Pods and shuttles are built at their own bay, not at the fabricator. ([#48](https://github.com/BigBadLoser/cc-ftl/issues/48))
- **More job types.** Escort runs, high-risk prisoners and classified cargo. ([#179](https://github.com/BigBadLoser/cc-ftl/issues/179))
- **Small quality-of-life fixes.** Research hints on locked items, clearer trade wording, fuel on job cards, a skills row in the crew inspector. ([#176](https://github.com/BigBadLoser/cc-ftl/issues/176))
- **Clearer ship overview.** A labelled by-the-numbers overview; the clickable alerts shipped. ([#164](https://github.com/BigBadLoser/cc-ftl/issues/164))
- **UI scale setting.** Scale the whole interface from the display settings. ([#215](https://github.com/BigBadLoser/cc-ftl/issues/215))

## Parked

- **Addictions.** Drinker and stim-hooked crew, until there are things to get addicted to. ([#239](https://github.com/BigBadLoser/cc-ftl/issues/239))
- **Ribcage healing pod (art idea).** A violet fluid column inside spiralling bone ribs on a root mound, magenta nodes, a
  glowing sac on a vein: too alien for the crew's recovery pod, kept for alien or derelict tech (a hive healer, a creature
  incubator). Look study `r1` in `tools/blender/sprites/recovery_study3.py`.
