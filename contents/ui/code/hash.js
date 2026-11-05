.pragma library

// SHA-256 (FIPS 180-4). LocalStorage receives only opaque digests, including
// reset-credit receipt material; no Qt/network/Node dependency is required.
function sha256(text) {
    var encoded = unescape(encodeURIComponent(String(text))), bytes = []
    for (var i = 0; i < encoded.length; i++) bytes.push(encoded.charCodeAt(i))
    var bitLength = bytes.length * 8
    bytes.push(128)
    while (bytes.length % 64 !== 56) bytes.push(0)
    var high = Math.floor(bitLength / 4294967296), low = bitLength >>> 0
    for (i = 3; i >= 0; i--) bytes.push((high >>> (i * 8)) & 255)
    for (i = 3; i >= 0; i--) bytes.push((low >>> (i * 8)) & 255)
    var k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
    var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
    function rotate(x, n) { return (x >>> n) | (x << (32 - n)) }
    for (var offset = 0; offset < bytes.length; offset += 64) {
        var w = []
        for (i = 0; i < 16; i++) w[i] = (bytes[offset + i * 4] << 24) | (bytes[offset + i * 4 + 1] << 16) | (bytes[offset + i * 4 + 2] << 8) | bytes[offset + i * 4 + 3]
        for (i = 16; i < 64; i++) {
            var x = w[i - 15], y = w[i - 2]
            w[i] = (w[i - 16] + (rotate(x, 7) ^ rotate(x, 18) ^ (x >>> 3)) + w[i - 7] + (rotate(y, 17) ^ rotate(y, 19) ^ (y >>> 10))) | 0
        }
        var v = h.slice()
        for (i = 0; i < 64; i++) {
            var t1 = (v[7] + (rotate(v[4], 6) ^ rotate(v[4], 11) ^ rotate(v[4], 25)) + ((v[4] & v[5]) ^ (~v[4] & v[6])) + k[i] + w[i]) | 0
            var t2 = ((rotate(v[0], 2) ^ rotate(v[0], 13) ^ rotate(v[0], 22)) + ((v[0] & v[1]) ^ (v[0] & v[2]) ^ (v[1] & v[2]))) | 0
            v = [(t1 + t2) | 0, v[0], v[1], v[2], (v[3] + t1) | 0, v[4], v[5], v[6]]
        }
        for (i = 0; i < 8; i++) h[i] = (h[i] + v[i]) | 0
    }
    return h.map(function (word) { return ("00000000" + (word >>> 0).toString(16)).slice(-8) }).join("")
}
