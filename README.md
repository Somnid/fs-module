# fs-modules

A polyfill for getting ESM working from file:// paths.

The main file is: `js/components/fs-module.js`

This doesn't use real parsing so it's probably not very reliable.  Only supports paths relative to the web root.  You must select the root of the web folder, paths outside of this folder will fail to match.

Uses Native File System API which is unstable in Chromium browsers under flag `#native-file-system-api`

For more information about Native File System API: https://web.dev/native-file-system/