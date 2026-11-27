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
fontSize: lg
width: 1180
```
$ markdown-video render launch.md -o launch.mp4
✓ 1920×1080 · 30fps · h264 · rendered in seconds
```

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
!duration 2.6
!background #0c0718
!transition fade
!terminal
typing: true
speed: 100
fontSize: lg
width: 1180
```
$ npm install -g markdown-video
added 1 package in 4s
```

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
color: #d41674
fontFamily: display
animation: slideUp

---

!scene
!duration 2.6
!background #130a24
!transition fade
!text
npm install -g markdown-video
size: lg
color: #fff4ec
fontFamily: jetbrains
animation: fadeIn

---

!scene
!duration 3.4
!background #130a24
!transition fade
!text
the video you just watched is a 2kb text file.
it's in the repo.
size: lg
color: #fff4ec
fontFamily: display
animation: fadeIn
