# Xash3D-Emscripten
This is an updated version of the re-uploaded site hosting mittorn's [Emscripten](http://kripken.github.io/emscripten-site/) port of the [Xash3D](https://github.com/FWGS/xash3d) engine, that can run Half-Life: Deathmatch within your web browser.

# Requirements / recommended specs
This app runs best in [Mozilla Firefox](https://www.mozilla.org/en-GB/firefox/). However, if you host it somewhere else than localhost, you should have no problems connecting from chrome.

#### Half-Life recommended specs:

* **CPU SPEED:** 250 MHz or higher
* **RAM:** 512 MB or more
* **OS:** Windows 7 or higher
* **GRAPHICS CARD:** 32 MB+ video card

**This is what's recommended to play the game in the browser**

# How to run
You'll need docker, or some PaaS like fly.io that allows you to deploy containers.

Make sure to expose container ports 3000 and 3200, there's no need to expose UDP ports unless you want to allow external players to connect (i.e. not playing through the container's served version).

Connecting to 0.0.0.0 from the game console will proxy the request through websockets to the container's dedicated server, allowing you to play.

# Changes since then
* Added a "deploy and play" dockerfile
* Added websocket-udp proxy
* Added xash3d dedicated server
* Added some maps and 3d models
* Changed the frontend to use IndexDB as the Emscripten FS mount point holding the game files
* Removed other mods (uplink, hc)
* Removed google analytics

# Changes in the re-upload
* Cleaned up UI (Added separators, options title, loading spinner and glow effects)
* Removed unused/test files
* Completely revamped "intro" page (memory selection screen)
* Added 404 page, favicon and README
* Fixed typo for Hazard Course title
