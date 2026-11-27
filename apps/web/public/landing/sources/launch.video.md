!music ./assets/launch-theme.mp3 volume:0.32 fade:0.6s loop:false

!scene
!duration 2.4
!background #130a24
!transition fade
!text
this video is a text file.
size: 2xl
color: #fff4ec
fontFamily: display
animation: fadeIn

---

!scene
!duration 3.2
!background #130a24
!transition fade
!code
typing: true
speed: 110
fontSize: lg
fontFamily: jetbrains
width: 1180
```md
!scene
!duration 2.4
!background #130a24
!text
this video is a text file.
size: 2xl
animation: fadeIn
```

---

!scene
!duration 2.8
!background #0c0718
!transition fade
!terminal
typing: true
speed: 90
$ markdown-video render launch.video.md -o launch-v2.mp4
> 1920×1080 · 30fps · h264

---

!scene
!duration 2.2
!background #fff4ec
!transition fade
!text
the editor writes the markdown for you.
size: xl
color: #2b1030
fontFamily: display
animation: slideUp

---

!scene
!duration 2.4
!background #0c0718
!transition fade
!terminal
typing: true
speed: 100
$ npm install -g markdown-video

---

!scene
!duration 2.8
!background #130a24
!transition fade
!code
typing: true
speed: 110
fontSize: lg
fontFamily: jetbrains
width: 1180
```sh
claude mcp add --transport http \
  markdown-video \
  https://markdownvideo.avikmukherjee.com/mcp
```

---

!scene
!duration 2.2
!background #d41674
!transition fade
!text
captions. music. locales. agents.
size: xl
color: #fff4ec
fontFamily: sans
animation: slideUp

---

!scene
!duration 2.6
!background #130a24
!transition fade
!text
write markdown.
size: 2xl
color: #fff4ec
fontFamily: display
animation: fadeIn

---

!scene
!duration 2.6
!background #130a24
!transition fade
!text
render the video.
size: 2xl
color: #ff4fa3
fontFamily: display
animation: slideUp

---

!scene
!duration 3.2
!background #130a24
!transition fade
!text
markdownvideo.avikmukherjee.com
size: lg
color: #fff4ec
fontFamily: mono
animation: fadeIn
