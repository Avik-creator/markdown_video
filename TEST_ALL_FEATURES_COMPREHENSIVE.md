!var brandColor #3b82f6
!var accentColor #ec4899
!var secondaryColor #10b981

---

!scene
!chapter "1. Text Scenes"
!text
Text Scene Features
animation: bounceIn
size: 2xl
color: #ffffff
fontFamily: sans

!duration 3s
!background $brandColor
!transition fade

---

!scene
!text
Serif Font
animation: slideUp
size: xl
color: #fbbf24
fontFamily: serif

!duration 2s
!background #78350f

---

!scene
!text
Sans Font
animation: slideUp
size: xl
color: #60a5fa
fontFamily: sans

!duration 2s
!background #0c4a6e

---

!scene
!text
Mono Font
animation: slideUp
size: xl
color: #f87171
fontFamily: mono

!duration 2s
!background #7f1d1d

---

!scene
!text
Display Font
animation: slideUp
size: xl
color: #a78bfa
fontFamily: display

!duration 2s
!background #4c1d95

---

!scene
!text
Line 1
Line 2
Line 3
Line 4
animation: slideUp
stagger: 0.3s
size: lg
color: #ffffff

!duration 4s
!background #1e293b

---

!scene
!chapter "2. Code Scenes"
!text
Code Scene Features
animation: bounceIn
size: 2xl
color: #ffffff

!duration 2s
!background $brandColor
!transition fade

---

!scene
!code
fontSize: md
fontFamily: jetbrains
typing: true
speed: 40
highlight: 2-3

```javascript
const greeting = "Hello World";
console.log(greeting);
const result = greeting.length;
```

!duration 3s
!background #1e1e2e

---

!scene
!code
fontSize: lg
fontFamily: fira
typing: true
speed: 35

```python
def calculate(x, y):
    return x + y
result = calculate(5, 3)
```

!duration 3s
!background #1e1e2e

---

!scene
!code
fontSize: sm
fontFamily: source
typing: true
speed: 50

```rust
fn main() {
    println!("Rust Code");
}
```

!duration 3s
!background #1e1e2e

---

!scene
!code
fontSize: md
fontFamily: inconsolata
typing: true
speed: 45

```go
package main
import "fmt"
func main() {
    fmt.Println("Go Code")
}
```

!duration 3s
!background #1e1e2e

---

!scene
!code
fontSize: md
fontFamily: courier
typing: true
speed: 40

```java
public class Main {
    public static void main(String[] args) {
        System.out.println("Java");
    }
}
```

!duration 3s
!background #1e1e2e

---

!scene
!chapter "3. Animations"
!text
Animation Types
animation: bounceIn
size: 2xl
color: #ffffff

!duration 2s
!background $brandColor
!transition fade

---

!scene
!text
fadeIn Animation
animation: fadeIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
slideUp Animation
animation: slideUp
size: xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
slideDown Animation
animation: slideDown
size: xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
slideLeft Animation
animation: slideLeft
size: xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
slideRight Animation
animation: slideRight
size: xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
bounceIn Animation
animation: bounceIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
typewriter Animation
animation: typewriter
size: xl
color: #ffffff

!duration 3s
!background #1e293b

---

!scene
!chapter "4. Transitions"
!text
Transition Types
animation: bounceIn
size: 2xl
color: #ffffff

!duration 2s
!background $brandColor
!transition fade

---

!scene
!text
Fade Transition
animation: fadeIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b
!transition fade

---

!scene
!text
Slide Transition
animation: fadeIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b
!transition slide

---

!scene
!text
Wipe Transition
animation: fadeIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b
!transition wipe

---

!scene
!text
Zoom Transition
animation: fadeIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b
!transition zoom

---

!scene
!text
Magic Transition
animation: fadeIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b
!transition magic

---

!scene
!chapter "5. Camera & Keyframes"
!text
Camera Keyframes
animation: fadeIn
size: xl
color: #ffffff

!camera

- at:0s zoom:1
- at:1.5s zoom:1.3 pan:right
- at:3s zoom:1.5 pan:down
- at:4.5s zoom:1 shake:true shakeIntensity:medium

!duration 5s
!background #0f172a

---

!scene
!chapter "6. Particles"
!text
Confetti Particles
animation: bounceIn
size: 2xl
color: #ffffff

!particles type:confetti intensity:high
!duration 3s
!background #1e293b

---

!scene
!text
Snow Particles
animation: bounceIn
size: 2xl
color: #ffffff

!particles type:snow intensity:medium
!duration 3s
!background #1e293b

---

!scene
!text
Rain Particles
animation: bounceIn
size: 2xl
color: #ffffff

!particles type:rain intensity:high
!duration 3s
!background #1e293b

---

!scene
!text
Sparkles Particles
animation: bounceIn
size: 2xl
color: #ffffff

!particles type:sparkles intensity:medium
!duration 3s
!background #1e293b

---

!scene
!text
Fireworks Particles
animation: bounceIn
size: 2xl
color: #ffffff

!particles type:fireworks intensity:high
!duration 3s
!background #1e293b

---

!scene
!chapter "7. Text Sizes"
!text
Small Text
animation: fadeIn
size: sm
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
Medium Text
animation: fadeIn
size: md
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
Large Text
animation: fadeIn
size: lg
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
Extra Large Text
animation: fadeIn
size: xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!text
2XL Text
animation: fadeIn
size: 2xl
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!chapter "8. Colors"
!text
Red Color
animation: fadeIn
size: xl
color: #ef4444

!duration 2s
!background #1e293b

---

!scene
!text
Orange Color
animation: fadeIn
size: xl
color: #f97316

!duration 2s
!background #1e293b

---

!scene
!text
Yellow Color
animation: fadeIn
size: xl
color: #eab308

!duration 2s
!background #1e293b

---

!scene
!text
Green Color
animation: fadeIn
size: xl
color: #22c55e

!duration 2s
!background #1e293b

---

!scene
!text
Blue Color
animation: fadeIn
size: xl
color: #3b82f6

!duration 2s
!background #1e293b

---

!scene
!text
Purple Color
animation: fadeIn
size: xl
color: #8b5cf6

!duration 2s
!background #1e293b

---

!scene
!text
Pink Color
animation: fadeIn
size: xl
color: #ec4899

!duration 2s
!background #1e293b

---

!scene
!chapter "9. Emoji"
!emoji 🎉 size:2xl animate:bounce

!duration 2s
!background #1e293b

---

!scene
!emoji 🚀 size:2xl animate:spin

!duration 2s
!background #1e293b

---

!scene
!emoji ⭐ size:2xl animate:pulse

!duration 2s
!background #1e293b

---

!scene
!emoji 🎨 size:2xl animate:shake

!duration 2s
!background #1e293b

---

!scene
!chapter "10. Timeline Elements"
!text "Element 1" at:0s duration:1.5s animation:slideUp
!text "Element 2" at:1s duration:1.5s animation:slideUp
!text "Element 3" at:2s duration:1.5s animation:slideUp

!duration 4s
!background #3b82f6

---

!scene
!chapter "11. Localization"
!locale en
!text
Welcome to Markdown Video
English Version
animation: fadeIn
size: lg
color: #ffffff

!duration 2s
!background #1e293b

---

!locale es
!scene
!text
Bienvenido a Markdown Video
Versión en Español
animation: fadeIn
size: lg
color: #ffffff

!duration 2s
!background #1e293b

---

!locale fr
!scene
!text
Bienvenue à Markdown Video
Version Française
animation: fadeIn
size: lg
color: #ffffff

!duration 2s
!background #1e293b

---

!scene
!chapter "12. Image Scene"
!image
src: https://markdowneditor.avikmukherjee.me/icon.png
fit: contain

!duration 3s
!background #1e293b

---

!scene
!chapter "13. QR Code"
!qr
url: https://markdowneditor.avikmukherjee.me
size: 200
color: #ffffff
bg: #1e293b
label: "Markdown Video"

!duration 3s
!background #1e293b

---

!scene
!chapter "14. Countdown"
!countdown
from: 10
style: digital
color: #ec4899

!duration 11s
!background #1e293b

---

!scene
!chapter "15. Progress Bar"
!progress
value: 75
max: 100
style: bar
color: #3b82f6
label: "Loading..."

!duration 2s
!background #1e293b

---

!scene
!chapter "16. Summary"
!text
All Features Tested
animation: bounceIn
size: 2xl
color: #ffffff

✓ Text Scenes
✓ Code Scenes
✓ Animations
✓ Transitions
✓ Camera Keyframes
✓ Particles
✓ Text Sizes
✓ Colors
✓ Emoji
✓ Timeline Elements
✓ Localization
✓ Images
✓ QR Codes
✓ Countdown
✓ Progress Bars

!particles type:confetti intensity:high
!duration 4s
!background $brandColor
!transition fade
