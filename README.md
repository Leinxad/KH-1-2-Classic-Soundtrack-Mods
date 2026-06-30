# KH1 & KH2 Classic Soundtrack Mods

A collection of OpenKH-based music mods and a tool for the Kingdom Hearts PC collection. Mix and match Classic (PS2) and Remastered (HD ReMIX) tracks per-song, or restore the full PS2 soundtrack in one click. Includes an in-game Soundtrack Switcher.

---

## Overview

This project covers six mods:

| Mod | Game | Description |
|-----|------|-------------|
| Classic Soundtrack | KH1FM PC | Replaces the full KH1 PC soundtrack with the original PS2 version |
| Classic Soundtrack | KH2FM PC | Replaces the full KH2 PC soundtrack with the original PS2 version |
| Track Selector | KH1FM PC | Tool to build a custom per-track mix of Classic and Remastered audio |
| Track Selector | KH2FM PC | Tool to build a custom per-track mix of Classic and Remastered audio |
| Soundtrack Switcher | KH1FM PC | Switch between Custom / Classic / Remastered in-game via button combos |
| Soundtrack Switcher | KH2FM PC | Switch between Custom / Classic / Remastered in-game via button combos |

---

## Requirements

- **OpenKH** with **Panacea** and **Lua Backend** installed and configured — [Download](https://github.com/OpenKH/OpenKh/releases)

---

## Classic Soundtrack — Installation

Download `Soundtrack.kh1pcpatch` (KH1) or `Soundtrack.kh2pcpatch` (KH2) and install it using **OpenKH Mods Manager**.

> **Note:** This mod does not replace the Atlantica minigame songs in KH2 to avoid conflicts with dub mods.

---

## Track Selector — Installation

The Track Selector lets you build a custom patch with a different choice of Classic or Remastered audio for each individual track.

1. Open the Track Selector app, go to the **Downloads** tab for your game, and download both the **Classic** and **Remastered** base patch files.
2. Switch to the **Selector** tab, upload both patches, choose a version per track, and click **Get Patch**.
3. Install the generated `.kh1pcpatch` / `.kh2pcpatch` file using **OpenKH Mods Manager**.

---

## Soundtrack Switcher — Installation

The Switcher lets you change between **Custom**, **Classic**, and **Remastered** soundtracks on the fly while the game is running — no restart needed.

### KH1 Button Combos

| Buttons | Mode | Audio |
|---------|------|-------|
| Select + R2 + Square | Custom | OpenKH / modded audio (`amusic`) |
| Select + R2 + Triangle | Classic | PS2 classic audio (`amusi2`) |
| Select + R2 + Circle | Remastered | HD remastered audio (`amusi3`) |

### KH2 Button Combos

| Buttons | Mode | Audio |
|---------|------|-------|
| Select + R2 + Square | Custom | OpenKH / modded audio (`bgm` / `vagstream`) |
| Select + R2 + Triangle | Classic | PS2 classic audio (`bg2` / `vagstrea2`) |
| Select + R2 + Circle | Remastered | HD remastered audio (`bg3` / `vagstrea3`) |

### Steps

Install the Switcher patch (`kh1-Switcher.zip` or `kh2-Switcher.zip`) using **OpenKH Mods Manager**. The Lua script is bundled inside the patch.

---

## Track Versions

- **Classic** — Original PS2 synthesised / MIDI soundtrack.
- **Remastered** — Fully orchestrated HD re-recording from the 1.5+2.5 HD ReMIX collection.
- **Custom** (Switcher only) — Your installed OpenKH mods / default PC audio.

---

## Credits

- **ThePenitentTextures1** — Found the loop points for the Classic Soundtrack tracks.
- **OpenKH Community Contributors** — Their knowledge and tools make extracting and patching the game files possible.

---

## Links

- [OpenKH](https://github.com/OpenKH/OpenKh/releases)
