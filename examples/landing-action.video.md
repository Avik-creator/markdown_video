!scene
!duration 2
!background #fff4ec
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
      - uses: Avik-creator/markdown_video/action@main
        with:
          markdown-path: release.md
          output-name: release-demo.mp4
          upload-release-asset: "true"
```
