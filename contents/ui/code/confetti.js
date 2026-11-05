.pragma library

var LIFETIME = 8500
var ANGLES = [270, 234, 198, 162, 126, 90]
function launches(x, y) {
    var out = []
    for (var phase = 0; phase < 6; phase++) {
        for (var side = 0; side < 2; side++) {
            for (var i = 0; i < 4; i++) out.push({ at: phase * 0.06 + i / 18, x: x + (side ? 12 : -12), y: y + 18,
                angle: ANGLES[side ? 5 - phase : phase], phase: phase })
        }
    }
    return out.sort(function (a, b) { return a.at - b.at })
}
function tracer(launch, scale) {
    var angle = (launch.angle + (Math.random() - 0.5) * 12) * Math.PI / 180
    var speed = (1.36 + 0.04 * launch.phase + (Math.random() - 0.5) * 0.24) * scale
    return { x: launch.x, y: launch.y, vx: Math.sin(angle) * speed, vy: Math.cos(angle) * speed,
        age: 0, life: 0.58 + 0.03 * launch.phase, tracer: true, rotation: 0, spin: 6, shape: 1, color: "white", size: 0.34 + (Math.random() - 0.5) * 0.16 }
}
function explode(parent, scale, palette) {
    var out = []
    for (var i = 0; i < 42; i++) {
        var angle = Math.random() * Math.PI * 2, speed = (0.72 + (Math.random() - 0.5) * 0.88) * scale
        out.push({ x: parent.x, y: parent.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            age: 0, life: 8, tracer: false, rotation: Math.random() * Math.PI * 2, spin: 3 + (Math.random() - 0.5) * 28,
            shape: i % 3, color: palette[Math.floor(Math.random() * palette.length)], size: 0.74 + (Math.random() - 0.5) * 0.52 })
    }
    return out
}
function step(particles, dt, scale, palette) {
    var out = []
    particles.forEach(function (p) {
        p.age += dt
        if (p.age >= p.life) {
            if (p.tracer) out = out.concat(explode(p, scale, palette))
            return
        }
        var damping = 1 - (p.tracer ? 0.06 : 0.34) * dt / p.life
        p.vx *= damping; p.vy = p.vy * damping + (p.tracer ? 0.12 : 0.32) * scale * dt
        p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.spin * dt
        out.push(p)
    })
    return out
}
