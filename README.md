# Claude Code mods

Animated backdrop themes for the Claude Code Desktop app, each showing at a glance whether Claude is working or waiting on you, plus a [Session Diary](#-session-diary) side panel.

## Themes

| Mod | While Claude works | When Claude needs you |
| --- | --- | --- |
| 🌸 **[Wisteria Moon](#-wisteria-moon)** | ![Wisteria Moon while Claude works](images/wisteria-moon-working.png) | ![Wisteria Moon when Claude needs you](images/wisteria-moon-waiting.png) |
| 🏴‍☠️ **[Grand Tide](#%EF%B8%8F-grand-tide)** | ![Grand Tide while Claude works](images/grand-tide-working.png) | ![Grand Tide when Claude needs you](images/grand-tide-waiting.png) |
| 🥷 **[Shinobi Dusk](#-shinobi-dusk)** | ![Shinobi Dusk while Claude works](images/shinobi-dusk-working.png) | ![Shinobi Dusk when Claude needs you](images/shinobi-dusk-waiting.png) |

All art is original vector drawing, animated with CSS only.

## Install

The themes need the Claude Code Desktop app, with a recent Claude Code in its Code tab; the terminal draws no theme. Session Diary works everywhere, the terminal included.

At the prompt of a terminal session:

```
/plugin install wisteria-moon --marketplace nitingpt000/claude-mods
```

```
/plugin install grand-tide --marketplace nitingpt000/claude-mods
```

```
/plugin install shinobi-dusk --marketplace nitingpt000/claude-mods
```

```
/plugin install session-diary --marketplace nitingpt000/claude-mods
```

Answer `y` to add the marketplace, then pick a scope (user is the usual choice).

From a shell:

```sh
claude plugin install wisteria-moon --marketplace nitingpt000/claude-mods
claude plugin install grand-tide --marketplace nitingpt000/claude-mods
claude plugin install shinobi-dusk --marketplace nitingpt000/claude-mods
claude plugin install session-diary --marketplace nitingpt000/claude-mods
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `nitingpt000/claude-mods`, then **Add plugin**.

Then start a new local session in the Code tab and send a message: the scene comes up behind the chat.

**Keep one theme on at a time.** Each sets the backdrop when a session starts, so with several on you get whichever loads last. Switch with `claude plugin enable <mod>` and `claude plugin disable <mod>`. Session Diary isn't a theme, so it works alongside any of them.

## 🌸 Wisteria Moon

A Taishō-era night by a river.

- **While Claude works:** wisteria hangs from wooden pergolas in both top corners, swaying and shedding petals. A castle keeps its lamps lit on the far ridge, mist drifts between the mountains, and a red arched bridge, stone lanterns, reeds and fireflies line the moonlit river. A lone swordsman keeps watch on a rock.
- **When Claude needs you:** the sky and river turn crimson, the swordsman raises his blade, and two crescent arcs, one of water and one of flame, sweep around the moon while embers rise. The arcs tilt differently each time.
- **Colors:** indigo-night surfaces with a wisteria-violet accent, dark mode only.

## 🏴‍☠️ Grand Tide

A galleon at sunset on the open sea.

- **While Claude works:** sun rays turn slowly behind clouds lit from below, a lighthouse sweeps its beam from a far cliff, waves roll in layers and sparkle along the sun's path, and gulls glide. A three-masted ship rides the swell under full sail, and a gull rests on old pier posts in the corner.
- **When Claude needs you:** the sky turns gold, the sails furl and gulls burst from the ship. A treasure map unrolls with islands, a sea serpent doodle, a turning compass rose and a dotted route to a glowing red X. The route is different each time.
- **Colors:** deep-sea navy surfaces with a sunset-gold accent, dark mode only.

## 🥷 Shinobi Dusk

A hidden ninja village at dusk.

- **While Claude works:** a full moon rises over a dusk sky, a five-tier pagoda and a village of curved rooftops with flickering windows, red paper lanterns swaying on a string, and leaves tumbling down. Now and then a shinobi leaps across the rooftops.
- **When Claude needs you:** the sky turns red and a glowing 忍 seal ignites in the upper right, ringed by two whirls of leaves turning in opposite directions. A shuriken flies in and strikes the ring, and the shinobi stands watch on the watchtower, scarf in the wind. The shuriken comes from a new angle each time.
- **Colors:** plum-black surfaces with an ember-orange accent, dark mode only.

## 📔 Session Diary

A side panel with a live timeline of everything Claude does in the session. It opens when a session starts; `/diary` opens it again.

```
12 calls · 4 edits · 6 commands · 1 failed
[ All ] [ Edits ] [ Commands ] [ Failures ] [ Clear ]

13:41:58  💬 Split the token logic into its own file
13:42:03    📄 Read     auth/session.ts                 ✔
13:42:05    ✏️ Edit     auth/token.ts      +48 −12       ✔
13:42:09    ▶ Bash      npm test                        ✔ 3.2s
13:42:15    ▶ Bash      git push                        ✘ failed 1.1s
13:42:20      ↳ 🤖 Agent  Review the diff                 … running
```

- Each prompt you send starts a new section. Automated prompts, such as a background task's notice, are left out.
- Every tool call shows its time, a kind icon (edit, command, read, search, web, agent, connector) and a short label: the command, the file, the pattern or the URL.
- Edits and writes show lines added and removed.
- Status is `… running` while it works, then ✔ (with its duration when over a second), ✘ **failed** in red, or ⊘ **denied** when you refused a permission.
- Calls made by a subagent are indented with ↳.
- Filter by **All**, **Edits**, **Commands** or **Failures**, and **Clear** to start fresh. The newest 400 entries are kept.
- Works in the terminal, the Desktop app, VS Code and mobile. It only watches: it never blocks or changes a call.

## Theme details

- "Claude needs you" means its turn ended, it asked you a question, or a permission prompt is still unanswered after 1.5 s. The wait keeps Auto mode quiet, since it settles most prompts on its own.
- Your system's reduced-motion setting stills each scene and shows it finished.
- **To take a theme off:** turn the mod off, start a new session, then open Settings, search for `code appearance` and choose **Remove colors**.
- **Known gap:** there is no event for the moment you approve a permission prompt, so after you approve one the needs-you scene stays until that tool finishes.

## License

MIT
