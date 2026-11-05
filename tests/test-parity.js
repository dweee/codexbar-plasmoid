#!/usr/bin/env node
// Behavioral ports from upstream/main CodexBarTests (names below), plus Linux
// persistence/account-safety regressions. No Plasma installation is needed.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
function load(name) {
    const context = { console }
    vm.createContext(context)
    vm.runInContext(fs.readFileSync(`contents/ui/code/${name}.js`, 'utf8').replace(/^\.pragma library$/m, ''), context)
    return context
}
const P = load('pace'), E = load('sessionEquivalent'), H = load('history')
const R = load('resetDetector'), Q = load('quotaWarnings'), N = load('notificationsMac'), C = load('confetti')
const plain = x => JSON.parse(JSON.stringify(x))
const near = (a, b, epsilon = 0.01) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`)
const day = 86400000, hour = 3600000, iso = n => new Date(n).toISOString()
function window(used, minutes, reset) { return { usedPercent: used, windowMinutes: minutes, resetsAt: reset == null ? null : iso(reset) } }
let cases = 0
function test(name, fn) { fn(); cases++; console.log(`ok ${name}`) }

test('UsagePaceTests: weekly computes delta, ETA, stage and speed capacity', () => {
    let p = P.calculate(window(50, 10080, 4 * day), 10080, 0, 0)
    near(p.expectedUsedPercent, 42.857); near(p.deltaPercent, 7.143)
    assert.equal(p.stage, 'ahead'); assert.equal(p.willLastToReset, false); near(p.etaSeconds, 3 * day / 1000)
    p = P.calculate(window(5, 10080, 4 * day), 10080, 0, 0)
    assert.equal(p.stage, 'farBehind'); assert.equal(p.willLastToReset, true); assert.equal(p.etaSeconds, null)
    near(p.speedMultiplierToReset, 14.25)
    p = P.calculate(window(70, 10080, 0.7 * day), 10080, 0, 0)
    near(p.expectedUsedPercent, 90); near(p.speedMultiplierToReset, 3.857)
    assert.equal(P.calculate(window(10, 10080, 9 * day), 10080, 0, 0), null)
    assert.equal(P.calculate(window(12, 10080, 7 * day), 10080, 0, 0), null)
})
test('UsagePaceTests: five/six day calendar slices and working ETA', () => {
    // Local calendar matches Swift Calendar.current; use local dates, not UTC assumptions.
    const reset = new Date(2026, 5, 14).getTime(), friday = new Date(2026, 5, 12, 18).getTime()
    near(P.calculate(window(100, 10080, reset), 10080, friday, 5).expectedUsedPercent, 95)
    const monday = new Date(2026, 5, 15).getTime()
    near(P.calculate(window(90, 10080, monday), 10080, new Date(2026, 5, 13, 12).getTime(), 6).expectedUsedPercent, 100 * 5.5 / 6)
    near(P.calculate(window(90, 10080, monday), 10080, new Date(2026, 5, 14, 12).getTime(), 6).expectedUsedPercent, 100)
    const w = window(80, 10080, new Date(2026, 5, 17).getTime())
    const p = P.calculate(w, 10080, friday, 5)
    assert.ok(p.etaSeconds > 2 * 86400, 'ETA must include the weekend')
})
test('UsagePaceTextTests: exact copy, headroom, session and risk', () => {
    let p = P.calculate(window(50, 10080, 4 * day), 10080, 0, 0)
    assert.equal(P.text(p, false, 'codex'), 'Pace: 7% in deficit · Runs out in 3d')
    p = P.calculate(window(10, 10080, 4 * day), 10080, 0, 0)
    assert.equal(P.text(p, false, 'codex'), 'Pace: 33% in reserve · Lasts until reset · 1.5× headroom')
    assert.equal(P.text(p, false, 'claude'), 'Pace: 33% in reserve · Lasts until reset')
    assert.equal(P.text({stage:'onTrack',deltaPercent:0,willLastToReset:false,etaSeconds:61,runOutProbability:0.526}, true, 'codex'), 'Pace: On pace · Projected empty in 2m (55% risk)')
    assert.equal(P.text({stage:'ahead',deltaPercent:7,willLastToReset:false,etaSeconds:0}, true, 'codex'), 'Pace: 7% in deficit · Projected empty now')
    assert.equal(P.duration(2 * 86400 + 5 * 60), '2d 5m')
    assert.equal(P.resolve(null, window(100, 300, hour), 300, 0, 0, 'codex'), null)
    assert.equal(P.resolve(null, window(5, 300, 4.99 * hour), 300, 0, 0, 'codex'), null)
})
function fixture(burns) {
    const wr = 2000000000000, s = [], w = []
    const base = wr - 6 * day
    burns.forEach((burn, i) => {
        const start = base + i * 5 * hour, reset = start + 5 * hour
        // Aligned partial session observations normalize to a full allowance.
        s.push({ capturedAt: start + hour, usedPercent: 20, resetsAt: reset }, { capturedAt: start + 4 * hour, usedPercent: 80, resetsAt: reset })
        w.push({ capturedAt: start + hour, usedPercent: i * 2, resetsAt: wr }, { capturedAt: start + 4 * hour, usedPercent: i * 2 + burn * 0.6, resetsAt: wr })
    })
    const current = base + (burns.length + 1) * 5 * hour
    return { s, w, current, now: current - hour }
}
function estimate(f) { return E.estimate(f.s, f.w, f.current, f.now) }
test('SessionEquivalentForecastTests: latest seven median and aligned partial sessions', () => {
    let f = fixture([5,4,8,6,10,12,14,16]), e = estimate(f)
    assert.equal(e.sampleCount, 7); near(e.medianWeeklyPercentPerWindow, 10)
    assert.equal(estimate(fixture([8,12])), null)
    f = fixture([10,10,10]); near(estimate(f).medianWeeklyPercentPerWindow, 10)
    f.w.forEach(x => x.capturedAt += 1)
    assert.equal(estimate(f), null, 'one millisecond misalignment cannot pair')
})
test('SessionEquivalentForecastResetCorrectionTests: clean recent segment survives old reversal', () => {
    for (const count of [2,3]) {
        const f = fixture(Array(count).fill(6)), old = f.s[0].capturedAt - 150 * day
        f.s.unshift({capturedAt:old, usedPercent:10, resetsAt:old+5*hour}, {capturedAt:old+600000,usedPercent:20,resetsAt:old+4.5*hour})
        const e = estimate(f)
        if (count === 2) assert.equal(e, null)
        else { assert.equal(e.sampleCount,3); near(e.medianWeeklyPercentPerWindow,6) }
    }
})
test('SessionEquivalentForecastTests: validation, idle session, wording, integer windows', () => {
    const now = 1900000000000, burn = {medianWeeklyPercentPerWindow:10,sampleCount:3}
    const session = window(20,300,null), weekly = window(60,10080,now+49*hour)
    let f = E.forecast(session, weekly, burn, now)
    assert.equal(f.windowsUntilReset,9); assert.equal(f.estimatedWindowsToExhaustWeekly,4)
    assert.equal(E.text(f),'Est. 4 session quotas left · 9 windows until reset')
    assert.equal(E.text({estimatedWindowsToExhaustWeekly:0.3,windowsUntilReset:1}), 'Est. 0.3 session quota left · 1 window until reset')
    assert.equal(E.forecast(session,weekly,{medianWeeklyPercentPerWindow:0,sampleCount:3},now),null)
    assert.equal(E.forecast(window(20,300,now-1),weekly,burn,now),null)
    assert.equal(E.forecast(session,window(100,10080,now+day),burn,now),null)
    weekly.resetsAt=iso(now+50*hour); assert.equal(E.forecast(session,weekly,burn,now).windowsUntilReset,10)
})
test('PlanUtilizationHistory: hourly peaks, reset edge, pairing and bounded retention', () => {
    let h = H.record(null,window(10,300,5*hour),window(20,10080,6*day),0)
    h = H.record(h,window(35,300,5*hour),window(25,10080,6*day),25*60000)
    assert.equal(h.session[h.session.length-1].usedPercent,35)
    h = H.record(h,window(4,300,10*hour),window(26,10080,6*day),35*60000)
    assert.ok(h.session.some(x=>x.usedPercent===35)); assert.ok(h.session.some(x=>x.usedPercent===4))
    for(const entry of h.session) assert.ok(h.weekly.some(w=>w.capturedAt===entry.capturedAt))
    const huge = Array.from({length:17525},(_,i)=>({capturedAt:i*hour,usedPercent:i%100,resetsAt:null}))
    h = H.record({session:huge,weekly:huge},null,null,0)
    assert.equal(h.session.length,17520); assert.equal(h.weekly.length,17520)
})
function observation(used, at, boundary, extra={}) { return Object.assign({ provider:'claude',lane:'session',usedPercent:used,observedAt:at,resetBoundary:boundary,source:'oauth',plan:null,requiresLowConfirmation:false },extra) }
function resetSequence(seq, extra) {
    let state=null, posts=[]
    seq.forEach((x,i)=>{ const r=R.transition(state,observation(x[0],x[1],x[2],extra)); state=r.state;if(r.shouldPost) posts.push(i) })
    return {state,posts}
}
test('UsageStorePlanUtilizationCelebrationTests: crossing, boundary guard, source and freshness', () => {
    assert.deepEqual(resetSequence([[65,0,null],[0,hour,null]]).posts,[1])
    assert.deepEqual(resetSequence([[65,0,hour],[0,60000,hour],[0,120000,hour+119999],[0,180000,hour+120000]]).posts,[3])
    const first=R.transition(null,observation(65,100,hour)).state
    assert.equal(R.transition(first,observation(0,100,2*hour)).shouldPost,false)
    assert.equal(R.transition(first,observation(0,200,2*hour,{source:'web'})).shouldPost,false)
})
test('ResetConfirmationTests: anonymous Claude second low and weekly recovery hysteresis', () => {
    assert.deepEqual(resetSequence([[30,0,hour],[0,60000,2*hour],[1,120000,2*hour],[0,180000,2*hour]],{requiresLowConfirmation:true}).posts,[2])
    assert.deepEqual(resetSequence([[40,0,null],[0,60000,null],[3,120000,null],[0,180000,null],[3,240000,null],[4,300000,null],[0,360000,null]],{lane:'weekly'}).posts,[1,6])
})
test('Codex weekly: advanced five-percent and 60–1800s same-boundary candidate', () => {
    const c={provider:'codex',lane:'weekly',plan:'plus'}
    assert.deepEqual(resetSequence([[40,0,day],[5,60000,2*day]],c).posts,[1])
    assert.deepEqual(resetSequence([[40,0,day],[5,60000,day],[4,119999,day],[4,120000,day]],c).posts,[3])
    assert.deepEqual(resetSequence([[40,0,day],[5,60000,day],[4,1860001,day]],c).posts,[])
    assert.deepEqual(resetSequence([[20,0,day],[5,60000,day],[4,120000,day]],c).posts,[])
    let p=R.transition(null,observation(40,0,day,c)).state
    assert.equal(R.transition(p,observation(0,60000,2*day,{...c,plan:'pro'})).shouldPost,false)
})
test('Grok weekly requires elapsed previous boundary and advancing next boundary', () => {
    assert.deepEqual(resetSequence([[30,0,hour],[0,60000,2*hour],[0,hour,2*hour]],{provider:'grok',lane:'weekly'}).posts,[2])
})
test('LimitResetNotificationTests: restored receipt covers reset and survives JSON restart', () => {
    const o=observation(0,hour,2*hour), opts={sessionQuotaNotificationsEnabled:true,limitResetNotificationsEnabled:true}
    const prior=R.transition(null,observation(100,0,hour)).state
    const r=R.transition(prior,o)
    assert.equal(R.notice(r.state,prior,o,r.shouldPost,true,opts),'restored')
    const persisted=plain(r.state), r2=R.transition(persisted,{...o,observedAt:hour+1000})
    assert.equal(R.notice(r2.state,persisted,o,true,true,opts),null)
})
test('Quota warnings: sanitizer, initial low, smallest crossed, re-arm, source baseline', () => {
    assert.deepEqual(plain(Q.sanitize([120,50,20,20,-2])),[99,50,20,0])
    assert.deepEqual(plain(Q.sanitize('')),[50,20])
    let o={remaining:10,observedAt:0,source:'a'}, r=Q.threshold(null,o,[50,20])
    assert.equal(r.threshold,20); assert.deepEqual(plain(r.state.fired),[50,20])
    r=Q.threshold(r.state,{...o,observedAt:1},[50,20]); assert.equal(r.threshold,null)
    r=Q.threshold(r.state,{...o,remaining:80,observedAt:2},[50,20]); assert.equal(r.threshold,null)
    r=Q.threshold(r.state,{...o,observedAt:3},[50,20]); assert.equal(r.threshold,20)
    r=Q.threshold(r.state,{...o,observedAt:4,source:'b'},[50,20]); assert.equal(r.threshold,null)
    assert.equal(Q.threshold(null,{...o,remaining:0},[0]).threshold,null)
})
test('SessionQuotaTransitionReducer: initial depleted, tiny positive, trusted Codex boundary and two fresh positives', () => {
    const base={provider:'codex',remaining:0,observedAt:0,now:0,source:'a',resetBoundary:hour}
    let r=Q.session(null,base,true); assert.equal(r.kind,'depleted')
    r=Q.session(r.state,{...base,remaining:0.00001,observedAt:1,now:1},true); assert.equal(r.kind,null)
    r=Q.session(r.state,{...base,remaining:40,observedAt:2,now:2,resetBoundary:2*hour},true); assert.equal(r.kind,null); assert.equal(r.state.remaining,0.00001)
    r=Q.session(r.state,{...base,remaining:40,observedAt:hour,now:hour,resetBoundary:null},true); assert.equal(r.kind,null)
    const s=r.state
    r=Q.session(s,{...base,remaining:40,observedAt:hour,now:hour,resetBoundary:null},true); assert.equal(r.kind,null)
    r=Q.session(s,{...base,remaining:40,observedAt:hour+1,now:hour+1,resetBoundary:null},true); assert.equal(r.kind,'restored')
    r=Q.session(null,base,true)
    r=Q.session(r.state,{...base,remaining:40,observedAt:hour,now:hour,resetBoundary:2*hour},true); assert.equal(r.kind,'restored')
})
test('PredictivePaceWarningTests: positive ETA, probability, cycle drift, lasts re-arm', () => {
    const p={willLastToReset:false,etaSeconds:60}, b=1780000000000
    let r=N.predictive(null,p,b,300);assert.equal(r.fire,true)
    r=N.predictive(r.state,p,b+5*60000,300);assert.equal(r.fire,false)
    r=N.predictive(r.state,{...p,willLastToReset:true},b+6*60000,300);assert.equal(r.fire,false)
    r=N.predictive(r.state,p,b+7*60000,300);assert.equal(r.fire,true)
    assert.equal(N.predictive(null,{...p,runOutProbability:0.49},b,300).fire,false)
    assert.equal(N.predictive(null,{...p,etaSeconds:0},b,300).fire,false)
    assert.equal(N.predictive(null,{...p,etaSeconds:null},b,300).fire,false)
})
test('UpcomingResetNotificationTests: deepest stage, persistent receipts, next boundary, passed reset', () => {
    let r=N.upcoming(null,23*hour,0); assert.equal(r.fire,true); assert.equal(r.state.stage,0)
    r=N.upcoming(plain(r.state),23*hour,60000);assert.equal(r.fire,false)
    r=N.upcoming(r.state,23*hour,22.5*hour);assert.equal(r.fire,true);assert.equal(r.state.stage,1)
    assert.equal(N.upcoming(r.state,23*hour,23*hour).fire,false)
    r=N.upcoming(null,0.5*hour,0);assert.equal(r.state.stage,1)
    assert.equal(N.upcoming(r.state,24*hour,0).fire,true)
})
test('Credential episodes: clear auth signal only, once per episode, fresh recovery', () => {
    assert.equal(N.authenticationFailure({message:'connection timeout'}),false)
    assert.equal(N.authenticationFailure({code:'provider',message:'rate limit exceeded'}),false)
    const error={code:'token_expired'}
    let r=N.credential(false,error,false,true);assert.equal(r.fire,true)
    r=N.credential(r.state,error,false,true);assert.equal(r.fire,false)
    r=N.credential(r.state,null,true,true);assert.equal(r.state,false)
    assert.equal(N.credential(r.state,error,false,true).fire,true)
})
test('Codex credits: three-day cutoff and persistent inventory dedup', () => {
    const credits=[{id:'one',status:'available',expires_at:iso(day)},{id:'two',status:'available',expires_at:iso(4*day)}]
    let r=N.creditExpiry(null,credits,0);assert.equal(r.fire,true);assert.equal(r.expiries.length,1)
    r=N.creditExpiry(plain(r.state),credits,0);assert.equal(r.fire,false)
    assert.equal(N.creditExpiry(null,[{id:'expired',status:'available',expires_at:iso(-1)}],0).fire,false)
})
test('ScreenConfetti: 48 tracers, paired phases, 42 fragments and eight-second explosion life', () => {
    const launches=C.launches(100,100)
    assert.equal(C.LIFETIME,8500);assert.equal(launches.length,48)
    assert.equal(launches[0].angle,270);assert.equal(launches[1].angle,90)
    assert.ok(launches.every((x,i)=>!i||x.at>=launches[i-1].at))
    const p=C.tracer(launches[0],650), fragments=C.step([p],1,650,['#abc'])
    assert.equal(fragments.length,42);assert.ok(fragments.every(x=>x.life===8))
    assert.equal(C.step(fragments,9,650,['#abc']).length,0)
})
console.log(`${cases} macOS parity behavior groups passed`)
