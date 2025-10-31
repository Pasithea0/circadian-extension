# Circadian

A browser extension that tints pages by time of day (daytime, sunset, bedtime).

## Philosophy

Blue-light impacts our sleep and overall health by disrupting melanopsin receptor's normal function that calibrates our circadian rhythm. This extension's creation was inspired by [f.lux](https://justgetflux.com)'s ability to adjust your device's color profile temperature based on the time of day to aid in preventing this. It's not perfect (this extension definitely isn't) but it's a simple tool many users use to help. 

The idea: I was checking out some dark reader Firefox addons when I asked myself if any of these dark reader addons had temperature adjustments? I suspect not. And if I were to make an extension, I could use [Orion](https://kagi.com/orion) on my iPhone to install my extension and essentially get f.lux on my iPhone! (Apple shut down f.lux's app)
Obviously it's not system wide, but still kinda neat!

You can even pair Circadian with other dark reader extensions to get the best experience!

### How it works:

Circadian is really simple. It creates an invisible element over your whole web page, then applies a CSS filter to it! There's a bit of math involved to calculate the RGB values from the blackbody radiation scale, but that's essentially it!

## Installation

Find Circadian on the Chrome webstore and [Firefox addon store](https://addons.mozilla.org/en-US/firefox/addon/circadian/)!

Alternatively, download the latest release and install manually. Look up how, I can't be bothered explaining everything.

## Troubleshooting

- If the extension doesn't seem to work, first try restarting your browser. Sometimes the filter isn't applied right away.

- You may also need to grant permission to modify every website. (It's gotta add the filter)

- If you experience any issues, don't hesitate to open an issue!

## Development

Prerequisites: Node.js, pnpm

```bash
pnpm install
pnpm dev
```

## Build

```bash
# Chrome MV3
pnpm build:chrome

# Firefox MV3
pnpm build:firefox
pnpm package:firefox
```

Load the built output from `build/<target>-prod` (or dev for live preview) in the browser.

## Notes

- Icons are in `assets/`. I used magick to convert the logo from SVG to PNG. 

## License

MIT
