!scene
!duration 2
!background #f4f0e6
!code
typing: false
fontSize: lg
fontFamily: jetbrains
width: 1180
```yaml
name: Render release video
on:
  release:
    types: [published]

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Avik-creator/markdown_video/action@<sha>
        with:
          markdown-path: release.md
          output-name: release-demo.mp4
          upload-release-asset: "true"
```
