import QtQuick
import "code/confetti.js" as Firework

Canvas {
    id: canvas
    property var particlePalette: ["#736BD4", "#97A9F7", "#CFD4F7"]
    property point origin: Qt.point(width - 28, 8)
    property var particles: []
    property var launches: []
    property double started: 0
    property double previous: 0
    property real scale: height
    function begin() {
        particles = []
        launches = Firework.launches(Math.max(8, Math.min(width - 8, origin.x)), Math.max(8, Math.min(height - 8, origin.y)))
        started = Date.now(); previous = started
        frames.start()
    }
    Timer {
        id: frames
        interval: 16
        repeat: true
        onTriggered: {
            var now = Date.now(), elapsed = (now - canvas.started) / 1000
            var dt = Math.min(0.05, (now - canvas.previous) / 1000)
            canvas.previous = now
            while (canvas.launches.length && canvas.launches[0].at <= elapsed)
                canvas.particles.push(Firework.tracer(canvas.launches.shift(), canvas.scale))
            canvas.particles = Firework.step(canvas.particles, dt, canvas.scale, canvas.particlePalette)
            canvas.requestPaint()
            if (now - canvas.started >= Firework.LIFETIME) frames.stop()
        }
    }
    onPaint: {
        var ctx = getContext("2d")
        ctx.clearRect(0, 0, width, height)
        particles.forEach(function (p) {
            ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation + (p.shape === 2 ? Math.PI / 6 : 0))
            ctx.globalAlpha = p.tracer ? 1 : Math.min(1, (p.life - p.age) / 1.2)
            ctx.fillStyle = p.color
            var growth = p.size + ((p.tracer ? 0.4 : 0.94) - p.size) * p.age / p.life
            ctx.scale(growth, growth * (p.tracer ? 1.3 : 0.82))
            if (p.tracer) { ctx.shadowColor = "white"; ctx.shadowBlur = 1 }
            if (p.tracer || p.shape === 1) {
                var r = p.tracer ? 3 : 4.5
                ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
            } else {
                var w = p.shape === 0 ? 10 : 8, h = p.shape === 0 ? 20 : 16, radius = p.shape === 0 ? 2 : 4
                ctx.beginPath(); ctx.roundedRect(-w / 2, -h / 2, w, h, radius, radius); ctx.fill()
            }
            ctx.restore()
        })
    }
}
