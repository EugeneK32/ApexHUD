(() => {
  "use strict";
  const R = window.ApexRuntime;
  const root = document.getElementById("dashboard");
  const strip = document.getElementById("shift-strip");
  for (let i=0;i<12;i++){ const el=document.createElement("i"); el.className="shift-segment"; strip.append(el); }
  const segments=[...strip.children];
  const nodes={speed:document.getElementById("speed"),unit:document.getElementById("speed-unit"),gear:document.getElementById("gear"),rpm:document.getElementById("rpm"),state:document.getElementById("shift-state"),abs:document.getElementById("abs"),tc:document.getElementById("tc"),lim:document.getElementById("lim"),bb:document.getElementById("bb")};
  const defaults={speedUnit:"kmh",shiftDisplay:"segments",showRpm:true,showAids:true,showBrakeBias:true,showDemoInEditor:true,panelColor:"#08090b",panelOpacity:.94,gearColor:"#f7f7f8",speedColor:"#f7f7f8",accentColor:"#27c3e8",warningColor:"#f2c94c",shiftColor:"#ff4d5e",positiveColor:"#38d27a",mutedColor:"#8d9098",borderColor:"#2c2f35",cornerRadius:4,fontScale:.82};
  const demo={vehicle:{speedMetersPerSecond:52.8,gear:4,rpm:6475,shiftRpm:7200,shiftLightFirstRpm:5900,shiftLightLastRpm:7100,shiftLightBlinkRpm:7350,shiftIndicatorPercent:.76,throttle:.82,brake:0},driverAids:{absAvailable:true,absActive:false,tractionControlAvailable:true,tractionControlEnabled:true,tractionControlLevel:4,brakeBiasAvailable:true,brakeBiasPercent:53.2,pitLimiterAvailable:true,pitLimiterActive:false,revLimiterActive:false}};
  R.start({moduleId:"com.apexhud.dashboard",rootId:"dashboard",defaults,demo,
    applySettings(s){
      root.style.setProperty("--panel",R.hexToRgba(s.panelColor,s.panelOpacity)); root.style.setProperty("--gear",s.gearColor); root.style.setProperty("--speed",s.speedColor); root.style.setProperty("--accent",s.accentColor); root.style.setProperty("--warning",s.warningColor); root.style.setProperty("--shift",s.shiftColor); root.style.setProperty("--positive",s.positiveColor); root.style.setProperty("--muted",s.mutedColor); root.style.setProperty("--border",s.borderColor); root.style.setProperty("--radius",`${R.number(s.cornerRadius,10)}px`); root.style.setProperty("--font-scale",R.number(s.fontScale,1));
      root.classList.toggle("shift-line",s.shiftDisplay==="line"); root.classList.toggle("shift-hidden",s.shiftDisplay==="hidden"); root.classList.toggle("hide-rpm",!s.showRpm); root.classList.toggle("hide-aids",!s.showAids); root.classList.toggle("hide-bb",!s.showBrakeBias);
    },
    render(payload,{settings,hasFrame}){
      const v=payload.vehicle||{}, a=payload.driverAids||{}; const mps=Math.max(0,R.number(v.speedMetersPerSecond,0)); const mph=settings.speedUnit==="mph";
      nodes.speed.textContent=hasFrame?String(Math.round(mps*(mph?2.236936:3.6))):"—"; nodes.unit.textContent=mph?"MPH":"KM/H";
      const gear=Math.round(R.number(v.gear,0)); nodes.gear.textContent=hasFrame?(gear<0?"R":gear===0?"N":String(gear)):"N";
      const rpm=Math.max(0,R.number(v.rpm,0)); nodes.rpm.textContent=hasFrame?String(Math.round(rpm)):"—";
      const indicator=Number.isFinite(Number(v.shiftIndicatorPercent))?R.clamp(Number(v.shiftIndicatorPercent),0,1):null;
      const first=R.positive(v.shiftLightFirstRpm,R.positive(v.shiftRpm,7000)*.82); const shift=R.positive(v.shiftRpm,first*1.17); const blink=R.positive(v.shiftLightBlinkRpm,shift*1.04); const ratio=indicator??R.clamp(rpm/blink,0,1);
      const near=gear>0&&ratio>=.58, now=gear>0&&(a.revLimiterActive===true||ratio>=.985); root.classList.toggle("near-shift",near&&!now); root.classList.toggle("shift-now",now); root.classList.toggle("limiter",a.revLimiterActive===true);
      nodes.state.textContent=!hasFrame?"WAITING":a.pitLimiterActive?"PIT LIMITER":now?"SHIFT NOW":near?"BUILDING":"READY";
      segments.forEach((el,i)=>el.classList.toggle("on",i<Math.round(ratio*segments.length)));
      setAid(nodes.abs,"ABS",a.absAvailable===true&&a.absActive===true,false);
      const tcText=a.tractionControlAvailable===true&&Number.isFinite(Number(a.tractionControlLevel))?`TC ${Math.round(Number(a.tractionControlLevel))}`:"TC"; setAid(nodes.tc,tcText,a.tractionControlAvailable===true&&a.tractionControlEnabled===true,false);
      setAid(nodes.lim,"PIT",a.pitLimiterAvailable===true&&a.pitLimiterActive===true,a.revLimiterActive===true);
      nodes.bb.textContent=a.brakeBiasAvailable===true&&Number.isFinite(Number(a.brakeBiasPercent))?`BB ${Number(a.brakeBiasPercent).toFixed(1)}`:"BB —";
    }
  });
  function setAid(node,label,active,warning){node.textContent=label;node.classList.toggle("active",active);node.classList.toggle("warning",warning);}
})();
