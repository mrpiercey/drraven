/* ============================================================
   THE ADVENTURES OF DR. RAVEN — The Time Traveling Bookworm
   A retro side-scrolling platformer.
   Collect every book Dr. Raven has read in the past 20 years.
   Madeleine L'Engle books grant SUPER READER power.
   ============================================================ */
'use strict';

// ---------------------------------------------------------- setup
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
ctx.imageSmoothingEnabled = false;
const VW = 512, VH = 288;
const touchControls = document.getElementById('touch-controls');
const touchUI = !!touchControls && (
  matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
);
document.documentElement.classList.toggle('touch-ui', touchUI);

function fitCanvas() {
  // fill as much of the window as possible while keeping the aspect ratio
  const availableH = Math.max(120, innerHeight - (touchUI ? 0 : 26));
  const margin = touchUI ? 1 : 0.98;
  const s = Math.max(0.35, Math.min(innerWidth / VW, availableH / VH) * margin);
  cvs.style.width = Math.round(VW * s) + 'px';
  cvs.style.height = Math.round(VH * s) + 'px';
}
addEventListener('resize', fitCanvas); fitCanvas();
if (window.visualViewport) window.visualViewport.addEventListener('resize', fitCanvas);
document.addEventListener('fullscreenchange', fitCanvas);
document.addEventListener('webkitfullscreenchange', fitCanvas);

// ---------------------------------------------------------- input
const keys = {};
const pressed = {}; // edge-triggered, cleared each frame
// ↑ ↑ ↓ ↓ ← → ← → B A ENTER — opens the level select
const KONAMI = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a','enter'];
let konamiIdx = 0;
// Typing RAMONA during a level = no heart loss for that level only (reset by startLevel)
const RAMONA = 'ramona';
let ramonaIdx = 0;
// Typing ENDING on the title screen = tour mode: every level plus both endings
const ENDING_CODE = 'ending';
let endingIdx = 0;
// WASD aliases the arrow keys; Konami matching below uses the raw key so 'a' still counts as A
const WASD = { w: 'ArrowUp', a: 'ArrowLeft', s: 'ArrowDown', d: 'ArrowRight' };
const mapKey = key => WASD[key.toLowerCase()] || key;
addEventListener('keydown', e => {
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Tab','Enter'].includes(e.key)) e.preventDefault();
  const key = mapKey(e.key);
  if (!keys[key]) pressed[key] = true;
  keys[key] = true;
  const k = e.key.toLowerCase();
  let ramonaTyping = false;
  if ((G.state === 'intro' || G.state === 'play') && !G.ramona) {
    if (k === RAMONA[ramonaIdx]) {
      ramonaTyping = true; // the M in RAMONA shouldn't toggle mute
      if (++ramonaIdx === RAMONA.length) { ramonaIdx = 0; activateRamona(); }
    } else ramonaIdx = k === RAMONA[0] ? 1 : 0;
  }
  if (k === 'm' && !ramonaTyping) audio.toggleMute();
  if (G.state === 'title') {
    if (k === ENDING_CODE[endingIdx]) {
      if (++endingIdx === ENDING_CODE.length) {
        endingIdx = 0;
        audio.sfx('lengle');
        openLevelSelect(true);
      }
    } else endingIdx = k === ENDING_CODE[0] ? 1 : 0;
  }
  if (k === KONAMI[konamiIdx]) {
    if (++konamiIdx === KONAMI.length) { konamiIdx = 0; openLevelSelect(); }
  } else konamiIdx = k === KONAMI[0] ? 1 : 0;
  audio.unlock();
});
addEventListener('keyup', e => {
  keys[mapKey(e.key)] = false;
  // macOS swallows keyups while Cmd is held — clear movement keys on Cmd release
  if (e.key === 'Meta') for (const k of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ']) keys[k] = false;
});
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// browsers gate audio behind a user gesture — a click/tap should start the title music too
addEventListener('pointerdown', () => audio.unlock());

// ---------------------------------------------------------- RNG (seeded)
function RNG(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ---------------------------------------------------------- pixel font (3x5)
const FONT = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',
  E:'111100110100111',F:'111100110100100',G:'011100101101011',H:'101101111101101',
  I:'111010010010111',J:'001001001101010',K:'101101110101101',L:'100100100100111',
  M:'101111111101101',N:'110101101101101',O:'010101101101010',P:'110101110100100',
  Q:'010101101110011',R:'110101110110101',S:'011100010001110',T:'111010010010010',
  U:'101101101101011',V:'101101101101010',W:'101101111111101',X:'101101010101101',
  Y:'101101010010010',Z:'111001010100111',
  '0':'111101101101111','1':'010110010010111','2':'111001111100111','3':'111001011001111',
  '4':'101101111001001','5':'111100111001111','6':'111100111101111','7':'111001010010010',
  '8':'111101111101111','9':'111101111001111',
  ' ':'000000000000000','.':'000000000000010',',':'000000000010100',':':'000010000010000',
  '!':'010010010000010','?':'111001011000010',"'":'010010000000000','-':'000000111000000',
  '/':'001001010100100','(':'001010010010001',')':'100010010010100','+':'000010111010000',
  '&':'010101010101011','#':'101111101111101','*':'000101010101000','"':'101101000000000',
  ';':'000010000010100','_':'000000000000111','=':'000111000111000','%':'101001010100101',
  '<':'001010100010001','>':'100010001010100',
};
function normChar(c) {
  const u = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return FONT[u] ? u : (FONT[c] ? c : '?');
}
function drawText(str, x, y, scale, color, outline) {
  str = String(str).toUpperCase();
  let cx = Math.round(x);
  y = Math.round(y);
  for (let i = 0; i < str.length; i++) {
    const g = FONT[normChar(str[i])] || FONT['?'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      if (g[r * 3 + c] === '1') {
        if (outline) {
          ctx.fillStyle = outline;
          ctx.fillRect(cx + c * scale - 1, y + r * scale - 1, scale + 2, scale + 2);
        }
      }
    }
    cx += 4 * scale;
  }
  cx = Math.round(x);
  ctx.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const g = FONT[normChar(str[i])] || FONT['?'];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
      if (g[r * 3 + c] === '1') ctx.fillRect(cx + c * scale, y + r * scale, scale, scale);
    }
    cx += 4 * scale;
  }
}
function textW(str, scale) { return String(str).length * 4 * scale - scale; }
function drawTextC(str, cx, y, scale, color, outline) {
  drawText(str, cx - textW(str, scale) / 2, y, scale, color, outline);
}
function wrapPixelText(text, maxChars) {
  const lines = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (line && next.length > maxChars) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------------------------------------------------- sprites
const PAL = {
  '.': null,
  h:'#96682e', H:'#c69a52', L:'#e8cf92',           // bronze-blonde hair w/ highlights
  S:'#f6c9a0', D:'#d99e70',                         // skin
  G:'#23232e', g:'#3c3c4c',                         // dark / sunglasses
  W:'#ffffff', E:'#63a891', M:'#8a4536',            // white / seafoam eyes / mouth
  N:'#f0f0f4', P:'#8a9cc9',                         // white tank top / blue stripes
  J:'#3f6fb5', K:'#2c4f8a',                         // jeans
  B:'#c33b2f', b:'#8e2a22', p:'#f2e9d8',            // held book
  F:'#26262b', w:'#dddddd',                         // shoes
  l:'#2e6fd0',                                      // lanyard
  i:'#1a1424', r:'#c0392b',                         // ink blot
  R:'#d94436', m:'#7d1f16',                         // envelope
  c:'#7de8ff', O:'#ffd23e',                         // cyan wings / yellow
  d:'#5a3a86', T:'#7a52b0',                         // door frame purple
  C:'#3fae6a', y:'#ffd23e',                         // green / gold
  o:'#e8862e',                                      // orange
};
const BODY = [
  '........hHHHHHHh........',
  '......hHHHLHHHHHh.......',
  '.....hHHLLHHHHHHHh......',
  '....hHHHHLHHHHLHHHh.....',
  '....hHHHLHHHHHHLHHh.....',
  '...hHHHHLHHHHHLHHHHh....',
  '...hHLHHHHHHHHHHHLHh....',
  '...hHHSSSSSSSSSSSSHh....',
  '..hHHSShhSSSSSShhSSHh...',
  '..hHHSSWESSSSSSWESSHh...',
  '..hHLSSWESSSSSSWESSLh...',
  '..hHHSSSSSSDDSSSSSSHh...',
  '..hHySSSSSSSSSSSSSSyh...',
  '..hHySSSMWWWWWWMSSSyh...',
  '..hHHSSSSMMMMMMSSSSHh...',
  '..hHHHSSSSSSSSSSHHHHh...',
  '..hLHHHSSSSSSSSHHHHLh...',
  '..hLHHh..SSSSSS..hHHLh..',
  '..hLHh....SlS.....hHLh..',
  '..hHHh.NPNSlSNPN..hHHh..',
  '..hHH.NNPNNlNNPNN.HHh...',
  '..hHH.NNPNlNNNPNNSSbppb.',
  '..hHh.NNPNlNNNPNNSSbppb.',
  '..hH..SNPNNNNNPNS.Bbppb.',
  '......S.PNNNNNP.S.Bbppb.',
];
const PLAYER_STAND = BODY.concat([
  '.......JJJJKJJJJ........',
  '.......JJJK.KJJJ........',
  '.......JJK...KJJ........',
  '.......JJK...KJJ........',
  '.......JJK...KJJ........',
  '......FJJF...FJJF.......',
  '.....FFFFF...FFFFF......',
]);
const PLAYER_RUN1 = BODY.concat([
  '......JJJJJKJJJJJ.......',
  '.....JJJK...KJJJJ.......',
  '....JJK.......KJJJ......',
  '...JJK.........KJJ......',
  '..FJJ...........JJF.....',
  '.FFFF...........FFFF....',
  '........................',
]);
const PLAYER_RUN2 = BODY.concat([
  '.......JJJJKJJJJ........',
  '.......JJJKKKJJJ........',
  '........JJK.KJJ.........',
  '........JJK.KJJw........',
  '........JJKFJJF.........',
  '.......FJJFFFFF.........',
  '......FFFFF.............',
]);
const PLAYER_JUMP = BODY.concat([
  '......JJJJKJJJJJ........',
  '.....JJJK..KJJJJ........',
  '....JJJ.....KJJK........',
  '....FJJ......JJF........',
  '...FFFF......FFF........',
  '........................',
  '........................',
]);
const RAVEN_BIRD = [
  '......gg............',
  '.....gGGg...........',
  '....gGGGGgy.........',
  '....GGWGGGyy........',
  '....gGGGGgy.........',
  '.....GGGG...........',
  '..gGGGGGGGGg........',
  '.gGGGGGGGGGGGg......',
  'gGGGGGGGGGGGGGGg....',
  '.gGGGGGGGGGGGGGGGg..',
  '..gGGGGGGGGGGGGg....',
  '....GGGGGGGGg.......',
  '......yy.yy.........',
  '.....yy..yy.........',
];
const E_BLOT = [
  '..i..........i..',
  '.iii...ii...iii.',
  '.iiii.iiii.iiii.',
  '..iiiiiiiiiiii..',
  '.iiiiiiiiiiiiii.',
  'iiiWWiiiiiiWWiii',
  'iiiWriiiiiiWriii',
  '.iiiiiiiiiiiiii.',
  '.iiiiiiiiiiiiii.',
  '..iiiiiiiiiiii..',
  '.iii.iiiiii.iii.',
  '.ii...iiii...ii.',
  '..i....ii....i..',
  '.......ii.......',
];
const E_ENVELOPE = [
  'RRRRRRRRRRRRRRRR',
  'RmmRRRRRRRRRRmmR',
  'RRmmRRRRRRRRmmRR',
  'RRRmmRRRRRRmmRRR',
  'RGGWWRmmmmRWWGGR',
  'RRWWWRRRRRRWWWRR',
  'RRRRRRRRRRRRRRRR',
  'RRRmMMMMMMMMmRRR',
  'RRRRRRRRRRRRRRRR',
  'WmWmWmWmWmWmWmWm',
];
const E_MOTH = [
  '..cc..........cc..',
  '.cccc...GG...cccc.',
  'cccWcc.GGGG.ccWccc',
  'ccccccGGGGGGcccccc',
  '.ccccGGGOOGGGcccc.',
  '..ccGGGGGGGGGGcc..',
  '....GGGGOOGGGG....',
  '.....GGGGGGGG.....',
  '......GGGGGG......',
  '.......G..G.......',
  '......OO..OO......',
];
// Coffee with cream, steam, a handle, saucer, and two sugar cubes.
const COFFEE_SPR = [
  '.....w....w.......',
  '......w..w........',
  '...NNNNNNNN.......',
  '..NppppppppN......',
  '..NpBpBpBppN.NNN..',
  '..NppppppppNN...N.',
  '..NppppppppNN...N.',
  '..NppppppppNNNNNN.',
  '..NppppppppN......',
  '...NppppppN.......',
  '....NNNNNN........',
  '...gggggggg.......',
  '............WW....',
  '...........WW.WW..',
];
// Dr. Jack — black & white sheepadoodle mad scientist (goggles up, beaker in paw)
const JACK_SPR = [
  '.....WWGGWWWWGGWW.......',
  '...WGWWWWWWWWWWWWGW.....',
  '..GWWWWWWWWWWWWWWWWG....',
  '..GWOOOOOOOOOOOOOOWG....',
  '.GGWOccOOOOOOOccOWWGG...',
  '.GGWOccOOOOOOOccOWWGG...',
  '.GGWWOOOOOOOOOOOWWWGG...',
  '.GGGWWWWWWWWWWWWWWGGG...',
  '.GGGWWGGWWWWWWGGWWGGG...',
  '.GGGWWGWWWWWWWWGWWGGG...',
  '.GGWWWWWWWWWWWWWWWWGG...',
  '.GGWWWWWGGGGGGWWWWWGG...',
  '..GWWWWGGNNNNGGWWWWG....',
  '..GWWWWWGGGGGGWWWWWG....',
  '...WWWWWWGrrGWWWWWW.....',
  '....WWWWWWGGWWWWWW......',
  '......WWWWWWWWWW........',
  '.....LLLLLGGLLLLL.......',
  '....LLLLLGGGGLLLLL......',
  '...LLgLLLGGGGLLLgLL.....',
  '...LLgLLLLGGLLLLgLL.....',
  '..GGLgLLLLGGLLLLgLGG....',
  '..GGLgLLLLGGLLLLgLGCC...',
  '..GGLgLLLLLLLLLLgLCCCC..',
  '.....LgLLLLLLLLgL.CCCC..',
  '.....LLLLLLLLLLLL.......',
  '.....LLLLL..LLLLL.......',
  '.....GGGG....GGGG.......',
  '....GGGGG....GGGGG......',
  '........................',
];
// the Piercey kids (level 8 rescue)
const SCARLETT_SPR = [ // 14, dirty blonde
  '..dDDDDd..',
  '.dDDDDDDd.',
  '.dDSSSSDd.',
  '.dDSeSeDd.',
  '.dDSSSSDd.',
  '.dDSmmSDd.',
  '.dDDSSDDd.',
  '..dTTTTd..',
  '..TTTTTT..',
  '..dTTTTd..',
  '...J..J...',
  '...J..J...',
  '...F..F...',
];
const HANK_SPR = [ // 12, redhead
  '..rrrrrr..',
  '.rrrrrrrr.',
  '.rSSSSSSr.',
  '.rSeSSeSr.',
  '..SSSSSS..',
  '..SmmmmS..',
  '...SSSS...',
  '..GGGGGG..',
  '..GGGGGG..',
  '...J..J...',
  '...J..J...',
  '...F..F...',
];
const RAMONA_SPR = [ // 7, blue eyes, long hair
  '..bbbbbb..',
  '.bbbbbbbb.',
  '.bbSSSSbb.',
  '.bbSuSubb.',
  '.bbSSSSbb.',
  '.bbSmmSbb.',
  '.bbbSSbbb.',
  '.bbPPPPbb.',
  '.b.PPPP.b.',
  '.b.PPPP.b.',
  '...S..S...',
  '...F..F...',
];
// Dr. Raven's parents (level 1 kennel rescue)
const GDADDY_SPR = [ // large build, glasses, parted flowy dark brown hair, orange & blue
  '..hhhhhhhhhh..',
  '.hhhhhhhhhhhh.',
  '.hhSSSSSSShhh.',
  '.hGeGSSGeGhh..',
  '.hhSSSSSSSSh..',
  '..hSSmmmmSSh..',
  '...SSSSSSSS...',
  '..OOOOOOOOOO..',
  '.OOOOOOOOOOOO.',
  '.OOOOOOOOOOOO.',
  '.OOOOOOOOOOOO.',
  '.SOOOOOOOOOOS.',
  '..JJJJJJJJJJ..',
  '..JJJJ..JJJJ..',
  '..JJJJ..JJJJ..',
  '..JJJJ..JJJJ..',
  '..FFFF..FFFF..',
];
const PEP_SPR = [ // dark brown hair to her shoulders, blue dress, a little shorter
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hhSSSSSShh.',
  '.hhSeSSeShh.',
  '.hhSSSSSShh.',
  '.hhSmmmmShh.',
  '.hhhSSSShhh.',
  '.hhBBBBBBhh.',
  '..hBBBBBBh..',
  '..SBBBBBBS..',
  '..BBBBBBBB..',
  '.BBBBBBBBBB.',
  '.BBBBBBBBBB.',
  'BBBBBBBBBBBB',
  '...S....S...',
  '...F....F...',
];
// CC & Uncle B (Auburn rescue) — both decked out in orange & blue
const CC_SPR = [
  '..hhhhhhhh..',
  '.hhhhhhhhhh.',
  '.hhSSSSSShh.',
  '.hhSeSSeShh.',
  '.hhSSSSSShh.',
  '.hhSmmmmShh.',
  '.hhhSSSShhh.',
  '..OOOOOOOO..',
  '.OOOOOOOOOO.',
  '..SJJJJJJS..',
  '..JJJJJJJJ..',
  '.JJJJJJJJJJ.',
  '.JJJJJJJJJJ.',
  '...S....S...',
  '...F....F...',
];
const UNCLEB_SPR = [
  '...hhhhhhhh...',
  '..hhhhhhhhhh..',
  '..hSSSSSSSSh..',
  '..hSeSSSSeSh..',
  '..hSSSSSSSSh..',
  '..hSSmmmmSSh..',
  '...SSSSSSSS...',
  '..JJJJJJJJJJ..',
  '.JJOOOOOOOOJJ.',
  '.JJOOOOOOOOJJ.',
  '.SJJOOOOOOJJS.',
  '..JJJJJJJJJJ..',
  '..KKKK..KKKK..',
  '..KKKK..KKKK..',
  '..KKKK..KKKK..',
  '..FFFF..FFFF..',
];
// Butter & Bacon — the dachshunds (one art, two coats)
const DOXIE_SPR = [
  '.BB.............',
  'BBBB.........B..',
  'BeBBBBBBBBBBBB..',
  'BnBBBBBBBBBBB...',
  '.BBBBBBBBBBBB...',
  '..B..B....B..B..',
  '..F..F....F..F..',
];
// a Wilmore horse at full gallop (the B- in Horseback Riding never forgave her)
const HORSE_SPR = [
  '.MHH................',
  'MHHHH...............',
  'MHeHH...............',
  'MHHHH...............',
  '.HHHHMM.............',
  '.HHHBBBBBBBBBBBM....',
  '..HBBBBBBBBBBBBBM...',
  '...BBBBBBBBBBBBBM...',
  '...BBB.BBB.BB.BBM...',
  '...BB...BB.BB..BB...',
  '...FF...FF.FF..FF...',
];
// a crimson elephant loose in Auburn (it will not be missed)
const ELEPHANT_SPR = [
  '...RRRRRRRRRRRR.....',
  '..RRRRRRRRRRRRRR....',
  '.RReRRDDDDDRRRRRR...',
  'tRRRRRDDDDDDRRRRr...',
  'tRRRRRDDDDDDRRRrr...',
  '.tRRRRDDDDDRRRRRR...',
  '.ttRRRRRRRRRRRRRR...',
  '..tWRRRRRRRRRRRR....',
  '...RRR..RRR..RRR....',
  '...RRR..RRR..RRR....',
  '...DDD..DDD..DDD....',
];
// a UK med student, white coat and scrubs, full of questions
const STUDENT_SPR = [
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hSSSSSSh..',
  '..hSeSSeSh..',
  '..hSSSSSSh..',
  '..hSSmmSSh..',
  '...SSSSSS...',
  '..WWWWWWWW..',
  '.WWGGGGGGWW.',
  '.WWGGGGGGWW.',
  '.SWGGGGGGWS.',
  '.WWGGGGGGWW.',
  '..WWWWWWWW..',
  '...GG..GG...',
  '...GG..GG...',
  '...FF..FF...',
];
// a Kenwick skunk, tail up and ready to spray
const SKUNK_SPR = [
  '..............WW',
  '.............WWW',
  '.GG.........WWW.',
  'GGGG...WWWWWWWW.',
  'GeGG.WWWWWWWWGG.',
  'GGGGGGGGGGGGGG..',
  '.GGGGGGGGGGGGG..',
  '..G..G....G..G..',
  '..F..F....F..F..',
];
// a gulf-coast jellyfish, pulsing along
const JELLY_SPR = [
  '....pppppp....',
  '..pppppppppp..',
  '.ppWWpppppppp.',
  '.ppWppppppppp.',
  '.pppppppppppp.',
  '..pppppppppp..',
  '..u.u.u..u.u..',
  '..u.u.u..u.u..',
  '...u.u.u.u....',
  '..u.u.u..u.u..',
  '...u...u..u...',
];
// Donnie — the world's greatest husband, in his wedding suit
const DONNIE_SPR = [
  '.......kkkkkkkkk........',
  '.....kkkKkkkkkkkk.......',
  '....kkkkkkkkkkkkkk......',
  '....kkKkkkkkkkKkkk......',
  '....kkkkkkkkkkkkkk......',
  '...kkSSSSSSSSSSSSkk.....',
  '...kSSSSSSSSSSSSSSk.....',
  '...kSSkkSSSSSSkkSSk.....',
  '...kSSWeSSSSSSWeSSk.....',
  '...kSSWeSSSSSSWeSSk.....',
  '...kSSSSSSDDSSSSSSk.....',
  '...kSSSSSSSSSSSSSSk.....',
  '...kSSMWWWWWWWWMSSk.....',
  '...kSSSMWWWWWWMSSSk.....',
  '....kSSSMMMMMMSSSk......',
  '....kSSSSSSSSSSSSk......',
  '.....SSSSSSSSSSSS.......',
  '........SSSSSS..........',
  '......JJwwwwwwJJ........',
  '.....JJJwwTTwwJJJ.......',
  '....JJJJwwTTwwJJJJ......',
  '....JJJJwwTTwwJJJJ......',
  '....JSSJwwTTwwJSSJ......',
  '....JSSJwwwwwwJSSJ......',
  '....J..JJJJJJJJ..J......',
  '.......JJJJJJJJ.........',
  '.......JJJ..JJJ.........',
  '.......JJJ..JJJ.........',
  '.......JJJ..JJJ.........',
  '.......JJJ..JJJ.........',
  '......FJJF..FJJF........',
  '.....FFFFF..FFFFF.......',
];
const DOOR_SPR = [
  '.dddddddddddddddddddd.',
  'dddTTTTTTTTTTTTTTTTddd',
  'ddTTddddddddddddddTTdd',
  'ddTdWWWWWWWWWWWWWWdTdd',
  'ddTdWGGGGGGGGGGGGWdTdd',
  'ddTdWWWWWWWWWWWWWWdTdd',
  'ddTdddddddddddddddTTdd',
  'ddTTddddddddddddddTTdd',
  'ddTTdBBBBBdCCCCCdyTTdd',
  'ddTTdBBBBBdCCCCCdyTTdd',
  'ddTTdBBBBBdCCCCCdyTTdd',
  'ddTTdBBBBBdCCCCCdyTTdd',
  'ddTTdBBBBBdCCCCCdyTTdd',
  'ddTTddddddddddddddTTdd',
  'ddTTdOOOOOdPPPPPdyTTdd',
  'ddTTdOOOOOdPPPPPdyTTdd',
  'ddTTdOOOOOdPPPPPdyTTdd',
  'ddTTdOOOOOdPPPPPdyTTdd',
  'ddTTdOOOOOdPPPPPdyTTdd',
  'ddTTddddddddddddddTTdd',
  'ddTTdCCCCCdBBBBBdyTTdd',
  'ddTTdCCCCCdBBBBBdyTTdd',
  'ddTTdCCCCCdBBBBBdyTTdd',
  'ddTTdCCCCCdBBBBBdyTTdd',
  'ddTTdCCCCCdBBBBBdyTTdd',
  'ddTTddddddddddddddTTdd',
  'ddTTdPPPPPdOOOOOdyTTdd',
  'ddTTdPPPPPdOOOOOdyTTdd',
  'ddTTdPPPPPdOOOOOdyTTdd',
  'ddTTdPPPPPdOOOOOdyTTdd',
  'ddTTdPPPPPdOOOOOdyTTdd',
  'ddTTddddddddddddddTTdd',
  'dddTTTTTTTTTTTTTTTTddd',
  '.dddddddddddddddddddd.',
];
function makeSprite(rows, palOverride) {
  const w = rows[0].length, h = rows.length;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = (palOverride && palOverride[rows[y][x]]) || PAL[rows[y][x]];
    if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); }
  }
  return c;
}
function tinted(spr, color, alpha) {
  const c = document.createElement('canvas');
  c.width = spr.width; c.height = spr.height;
  const g = c.getContext('2d');
  g.drawImage(spr, 0, 0);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}
const SPR = {
  stand: makeSprite(PLAYER_STAND),
  run1: makeSprite(PLAYER_RUN1),
  run2: makeSprite(PLAYER_RUN2),
  jump: makeSprite(PLAYER_JUMP),
  raven: makeSprite(RAVEN_BIRD),
  blot: makeSprite(E_BLOT),
  env: makeSprite(E_ENVELOPE),
  moth: makeSprite(E_MOTH),
  coffee: makeSprite(COFFEE_SPR, {
    w: '#d9e8f0', N: '#f8f1dd', p: '#c99b6b', B: '#6b3e22', g: '#a88f78', W: '#ffffff',
  }),
  // door gets a wood-brown palette so it stands out from purple brick levels
  door: makeSprite(DOOR_SPR, { d: '#3a2410', T: '#96682e', W: '#ffe45a', G: '#3a2410' }),
  jack: makeSprite(JACK_SPR, {
    G: '#1c1c24', W: '#f0eef2', g: '#c4c2cc', L: '#e4e2ea',
    O: '#d9a516', c: '#7de8ff', N: '#111118', r: '#e87a9a', C: '#4ce860',
  }),
  scarlett: makeSprite(SCARLETT_SPR, {
    d: '#8f7638', D: '#b89a55', e: '#4e9a62', m: '#c46a6a',
    T: '#c9557a', J: '#3f6fb5', F: '#26262b',
  }),
  hank: makeSprite(HANK_SPR, {
    r: '#c9552e', e: '#6a4a2a', m: '#c46a6a',
    G: '#2e7e4e', J: '#3f6fb5', F: '#26262b',
  }),
  ramona: makeSprite(RAMONA_SPR, {
    b: '#6a4a2a', u: '#4a90d9', m: '#c46a6a',
    P: '#e86a9a', F: '#26262b',
  }),
  donnie: makeSprite(DONNIE_SPR, {
    k: '#3a2a1e', K: '#54402e', e: '#6a8ab5',
    J: '#26262e', w: '#f4f4f8', T: '#c33b2f',
  }),
  gdaddy: makeSprite(GDADDY_SPR, {
    h: '#4a3626', e: '#7de8ff', m: '#c46a6a',
    O: '#e8862e', J: '#2c4f8a', F: '#26262b',
  }),
  pep: makeSprite(PEP_SPR, {
    h: '#4a3626', e: '#5a3a26', m: '#c46a6a',
    B: '#3f6fb5', F: '#26262b',
  }),
  cc: makeSprite(CC_SPR, {
    h: '#6a4a2a', e: '#4e7a9a', m: '#c46a6a',
    O: '#e8862e', J: '#2c4f8a', F: '#26262b',
  }),
  uncleb: makeSprite(UNCLEB_SPR, {
    h: '#3a2a1c', e: '#5a3a26', m: '#c46a6a',
    J: '#2c4f8a', O: '#e8862e', K: '#3a3a44', F: '#26262b',
  }),
  butter: makeSprite(DOXIE_SPR, {
    B: '#d9a516', e: '#26262b', n: '#26262b', F: '#8a6a0e',
  }),
  bacon: makeSprite(DOXIE_SPR, {
    B: '#3a2114', e: '#e8d0a0', n: '#111', F: '#241208',
  }),
  horse: makeSprite(HORSE_SPR, {
    H: '#8a5a2e', B: '#8a5a2e', M: '#4a2e18', e: '#26262b', F: '#3a2412',
  }),
  elephant: makeSprite(ELEPHANT_SPR, {
    R: '#a51c30', D: '#7d1522', t: '#8a1522', r: '#8a1522',
    e: '#fff', W: '#f2e9d8',
  }),
  student: makeSprite(STUDENT_SPR, {
    h: '#4a3626', e: '#26262b', m: '#c46a6a',
    W: '#f4f4f8', G: '#3aa8a0', F: '#26262b',
  }),
  jelly: makeSprite(JELLY_SPR, {
    p: '#f08ad0', W: '#ffd0ee', u: '#c46ad8',
  }),
  skunk: makeSprite(SKUNK_SPR, {
    G: '#26262b', W: '#f4f4f8', e: '#ffffff', F: '#111118',
  }),
};
SPR.jackHurt = tinted(SPR.jack, '#ff4040', .5);
SPR.kids = [SPR.scarlett, SPR.hank, SPR.ramona];
SPR.parents = [SPR.gdaddy, SPR.pep];
SPR.superFrames = ['#ff5abf', '#5adfff', '#ffe45a'].map(col =>
  [SPR.stand, SPR.run1, SPR.run2, SPR.jump].map(s => tinted(s, col, .3)));

// book sprite cache — colored by hash
const BOOK_COLORS = ['#c0392b','#2e86c1','#27ae60','#8e44ad','#d68910','#16a085','#cb4335','#2874a6','#b03a2e','#7d3c98','#1e8449','#ba4a00'];
const bookCache = {};
function bookSprite(colIdx, gold) {
  const key = gold ? 'gold' : colIdx;
  if (bookCache[key]) return bookCache[key];
  const c = document.createElement('canvas');
  c.width = 12; c.height = 14;
  const g = c.getContext('2d');
  const base = gold ? '#ffd23e' : BOOK_COLORS[colIdx];
  const dark = gold ? '#c99b16' : shade(base, -40);
  g.fillStyle = dark; g.fillRect(0, 0, 12, 14);          // back cover
  g.fillStyle = '#f2e9d8'; g.fillRect(2, 1, 9, 12);      // pages
  g.fillStyle = base; g.fillRect(0, 0, 3, 14);           // spine
  g.fillStyle = base; g.fillRect(0, 0, 11, 2);           // top cover edge
  g.fillStyle = dark; g.fillRect(3, 6, 7, 1);            // page line
  g.fillStyle = dark; g.fillRect(3, 9, 7, 1);
  if (gold) {                                            // star on cover
    g.fillStyle = '#fff6d0';
    g.fillRect(5, 3, 2, 2); g.fillRect(4, 4, 4, 1);
  }
  bookCache[key] = c;
  return c;
}

// real covers from Dr. Raven's reading list — the floating bg books on the title
// and ending screens show actual books she's read (generic sprite until loaded)
const floatCovers = [];
{
  const pool = [];
  for (let i = 0; i < BOOKS.length; i++) if (BOOKS[i].img) pool.push(i);
  for (let n = 0; n < 20 && pool.length; n++) {
    const bi = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const entry = { c: null };
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = 20; c.height = 30;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, 20, 30);
      g.fillStyle = '#f2e9d8'; g.fillRect(18, 1, 2, 28); // page edge
      entry.c = c;
    };
    img.src = BOOKS[bi].img;
    floatCovers.push(entry);
  }
}
function floatBook(i, gold) {
  return (floatCovers[i % floatCovers.length] || {}).c || bookSprite(i % BOOK_COLORS.length, gold);
}
// real book covers, crunched down to 12x16 pixels (falls back to the
// procedural sprite while loading / offline)
const covers = {};
function loadCover(i) {
  if (covers[i] || !BOOKS[i].img) return;
  covers[i] = { st: 'load' };
  const im = new Image();
  im.onload = () => {
    try {
      const cv = document.createElement('canvas');
      cv.width = 12; cv.height = 16;
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = true;
      g.drawImage(im, 0, 0, 12, 16);
      g.imageSmoothingEnabled = false;
      g.fillStyle = 'rgba(0,0,0,.35)';
      g.fillRect(0, 0, 1, 16); // spine shadow
      covers[i] = { st: 'ok', cv };
    } catch (e) { covers[i] = { st: 'fail' }; }
  };
  im.onerror = () => { covers[i] = { st: 'fail' }; };
  im.src = BOOKS[i].img;
}
function coverOf(i) {
  const c = covers[i];
  return c && c.st === 'ok' ? c.cv : null;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

// ---------------------------------------------------------- audio
const audio = (() => {
  let ac = null, muted = false, musicTimer = null;
  let songStep = 0, nextNoteT = 0, currentSong = null, tempoMul = 1;
  const SONGS = {
    theme: { // gothic lullaby — a raven circling the library at bedtime (landing page only)
      bpm: 80,
      lead: [69,0,0,71,72,0,71,69,68,0,64,0,0,0,64,67,65,0,0,67,69,0,65,62,64,0,60,0,59,0,0,0],
      bass: [33,0,40,0,45,0,40,0,28,0,35,0,40,0,35,0,26,0,33,0,38,0,33,0,28,0,35,0,40,0,44,0],
    },
    title: {
      bpm: 92,
      lead: [64,0,67,0,71,0,69,67,64,0,62,0,60,0,62,64,60,0,64,0,67,0,71,72,71,0,67,0,64,0,0,0],
      bass: [36,0,43,0,36,0,43,0,33,0,40,0,33,0,40,0,31,0,38,0,31,0,38,0,36,0,43,0,36,0,43,0],
    },
    level: {
      bpm: 138,
      lead: [69,0,76,0,74,76,72,0,69,0,64,67,69,0,67,64,72,0,76,0,79,0,77,76,74,0,71,74,76,0,74,72],
      bass: [45,45,52,45,43,43,50,43,41,41,48,41,43,43,50,43,45,45,52,45,43,43,50,43,48,48,55,48,52,50,48,43],
    },
    story: { // ominous minor — a storm rolls in over the library
      bpm: 76,
      lead: [57,0,0,0,60,0,57,0,63,0,62,0,60,0,57,0,55,0,0,0,58,0,55,0,62,0,61,0,57,0,0,0],
      bass: [33,0,33,0,33,0,33,0,31,0,31,0,31,0,31,0,27,0,27,0,27,0,27,0,29,0,29,0,28,0,28,0],
    },
    happy: { // sunny major — birthday morning at the beach house (perfect ending)
      bpm: 126,
      lead: [72,0,72,74,76,0,76,77,79,0,77,76,74,0,72,0,77,0,77,79,81,0,79,77,76,0,74,76,72,0,0,0],
      bass: [36,0,43,0,36,0,43,0,41,0,48,0,43,0,50,0,41,0,48,0,36,0,43,0,43,0,50,0,36,0,43,0],
    },
  };
  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      musicTimer = setInterval(schedule, 40);
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }
  const f = n => 440 * Math.pow(2, (n - 69) / 12);
  function osc(type, freq, t0, dur, vol, slide) {
    if (!ac || muted) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(t0); o.stop(t0 + dur + .02);
  }
  function noise(t0, dur, vol, hp) {
    if (!ac || muted) return;
    const len = Math.ceil(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = buf;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const flt = ac.createBiquadFilter();
    flt.type = hp ? 'highpass' : 'lowpass';
    flt.frequency.value = hp ? 5000 : 900;
    s.connect(flt); flt.connect(g); g.connect(ac.destination);
    s.start(t0); s.stop(t0 + dur);
  }
  function schedule() {
    if (!ac || !currentSong || muted) return;
    // while the browser holds the context suspended (autoplay policy), keep asking —
    // the moment it's allowed, the song starts without waiting for our gesture handlers
    if (ac.state !== 'running') { ac.resume().catch(() => {}); return; }
    const song = SONGS[currentSong];
    const stepDur = (60 / (song.bpm * tempoMul)) / 2; // 8th notes
    if (nextNoteT < ac.currentTime) nextNoteT = ac.currentTime + .05;
    while (nextNoteT < ac.currentTime + .12) {
      const i = songStep % song.lead.length;
      if (song.lead[i]) osc('square', f(song.lead[i]), nextNoteT, stepDur * .9, .045);
      if (song.bass[i]) osc('triangle', f(song.bass[i]), nextNoteT, stepDur * .95, .09);
      if (i % 2 === 0) noise(nextNoteT, .03, .015, true);
      songStep++;
      nextNoteT += stepDur;
    }
  }
  return {
    unlock: ensure,
    toggleMute() { muted = !muted; },
    get muted() { return muted; },
    get running() { return !!ac && ac.state === 'running'; },
    play(name) { currentSong = name; songStep = 0; nextNoteT = 0; },
    stop() { currentSong = null; },
    tempo(m) { tempoMul = m; },
    sfx(name) {
      if (!ac || muted) return;
      const t = ac.currentTime;
      switch (name) {
        case 'jump': osc('square', 220, t, .12, .06, 520); break;
        case 'collect': osc('square', 880, t, .06, .05); osc('square', 1320, t + .06, .09, .05); break;
        case 'coffee':
          [523,659,784].forEach((fr, i) => osc('triangle', fr, t + i * .08, .2, .07));
          break;
        case 'lengle':
          [523,659,784,1047,1319,1568].forEach((fr, i) => osc('square', fr, t + i * .07, .12, .06));
          noise(t, .5, .02, true); break;
        case 'hurt': osc('sawtooth', 300, t, .25, .08, 60); noise(t, .2, .05); break;
        case 'door': [392,523,659,784].forEach((fr, i) => osc('triangle', fr, t + i * .09, .22, .09)); break;
        case 'clear': [523,587,659,784,880,1047,1319].forEach((fr, i) => osc('square', fr, t + i * .1, .16, .06)); break;
        case 'gameover': [392,370,349,311,262].forEach((fr, i) => osc('triangle', fr, t + i * .18, .3, .09)); break;
        case 'tick': osc('square', 1200, t, .04, .04); break;
        case 'pop': noise(t, .12, .06); osc('square', 600, t, .1, .05, 150); break;
        case 'menu': osc('square', 660, t, .06, .05); break;
        case 'land': noise(t, .05, .02); break;
        case 'throw': osc('square', 900, t, .14, .05, 250); noise(t, .08, .03, true); break;
        case 'bosshit': osc('sawtooth', 180, t, .2, .1, 50); noise(t, .15, .06); break;
        case 'bossdie': [880,830,780,700,600,450,300,180].forEach((fr, i) => osc('square', fr, t + i * .08, .12, .06)); noise(t + .6, .3, .06); break;
        case 'locked': osc('square', 140, t, .15, .08, 100); break;
        case 'bark': osc('square', 160, t, .09, .1, 90); osc('square', 190, t + .12, .11, .1, 100); break;
        case 'type': osc('square', 2200, t, .015, .02); break;
        case 'thunder': noise(t, 1.1, .12); osc('sine', 60, t, .9, .12, 30); break;
      }
    },
  };
})();

// Touch devices get multi-touch controls that feed the same input state as
// the keyboard. Pointer capture prevents held directions from getting stuck.
if (touchUI) {
  const touchPointers = new Map();
  let fullscreenAttempted = false;
  const keyFor = btn => btn.dataset.key === 'Space' ? ' ' : btn.dataset.key;
  const enterMobileFullscreen = () => {
    if (fullscreenAttempted || document.fullscreenElement || document.webkitFullscreenElement) return;
    fullscreenAttempted = true;
    const root = document.documentElement;
    try {
      let result;
      if (root.requestFullscreen) result = root.requestFullscreen({ navigationUI: 'hide' });
      else if (root.webkitRequestFullscreen) result = root.webkitRequestFullscreen();
      else if (root.webkitRequestFullScreen) result = root.webkitRequestFullScreen();
      Promise.resolve(result).then(() => {
        fitCanvas();
        if (innerHeight > innerWidth && screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch(() => {});
        }
      }).catch(() => {});
    } catch (e) {}
  };
  const releasePointer = pointerId => {
    const active = touchPointers.get(pointerId);
    if (!active) return;
    touchPointers.delete(pointerId);
    const stillHeld = [...touchPointers.values()].some(item => item.key === active.key);
    if (!stillHeld) keys[active.key] = false;
    const sameButtonHeld = [...touchPointers.values()].some(item => item.btn === active.btn);
    if (!sameButtonHeld) {
      active.btn.classList.remove('is-pressed');
      active.btn.setAttribute('aria-pressed', 'false');
    }
  };
  const releaseAllTouch = () => {
    for (const pointerId of [...touchPointers.keys()]) releasePointer(pointerId);
  };
  for (const btn of touchControls.querySelectorAll('[data-key]')) {
    btn.setAttribute('aria-pressed', 'false');
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      const key = keyFor(btn);
      if (!keys[key]) pressed[key] = true;
      keys[key] = true;
      touchPointers.set(e.pointerId, { btn, key });
      if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
      btn.classList.add('is-pressed');
      btn.setAttribute('aria-pressed', 'true');
      if (key === 'm') audio.toggleMute();
      audio.unlock();
      enterMobileFullscreen();
    });
    btn.addEventListener('pointerup', e => { e.preventDefault(); releasePointer(e.pointerId); });
    btn.addEventListener('pointercancel', e => releasePointer(e.pointerId));
    btn.addEventListener('lostpointercapture', e => releasePointer(e.pointerId));
    btn.addEventListener('contextmenu', e => e.preventDefault());
  }
  addEventListener('blur', releaseAllTouch);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllTouch();
  });
}

// ---------------------------------------------------------- book data & levels
const LVL_META = [
  { name: 'LOXLEY, ALABAMA',         sub: 'GULF COAST BEACH DAYS' },
  { name: 'WILMORE, KENTUCKY',       sub: 'COUNTRY ROADS & ASBURY COLLEGE' },
  { name: 'AUBURN, ALABAMA',         sub: 'FOOTBALL & THE MASTERS DEGREE' },
  { name: 'POINT CLEAR, ALABAMA',    sub: 'MARRYING THE GREATEST HUSBAND IN THE WORLD' },
  { name: 'LEXINGTON, KENTUCKY',     sub: 'HORSE COUNTRY & THE UK PHD' },
  { name: 'MEDICAL SCHOOL',          sub: 'PAGING DR. RAVEN' },
  { name: 'KENWICK',                 sub: 'SAVING SCARLETT, HANK & RAMONA' },
  { name: 'THE LAST BOOKS',          sub: "JACK'S KENNEL - THE FINAL BATTLE" },
];
// theme id + ground colors (g ground, gD shade, gT top edge, gX accent)
const THEMES = [
  { id: 'beach',    g: '#e8d494', gD: '#d4bc72', gT: '#f6e8b0', gX: '#c9a85e' },
  { id: 'country',  g: '#8a5a2e', gD: '#6e4522', gT: '#6cc94a', gX: '#5aa838' },
  { id: 'football', g: '#2e8a3a', gD: '#277531', gT: '#3fa84c', gX: '#e8f0e8' },
  { id: 'wedding',  g: '#f0e4e8', gD: '#d8c4cc', gT: '#fdf6f8', gX: '#e88aa8' },
  { id: 'horse',    g: '#8a5a2e', gD: '#6e4522', gT: '#5aa838', gX: '#4a8c2e' },
  { id: 'medical',  g: '#cfe0e4', gD: '#aec8ce', gT: '#e8f2f4', gX: '#8fb0b8' },
  { id: 'kenwick',  g: '#8a5a2e', gD: '#6e4522', gT: '#6cc94a', gX: '#5aa838' },
  { id: 'kennel',   g: '#6e6a72', gD: '#57535e', gT: '#807c88', gX: '#3e3a46' },
];
const LVL_PALS = [
  // beach: bright gulf day
  { sky1:'#3a9ae0', sky2:'#a8e0f0', wall:'#8a6a42', wallD:'#6a4f30', brick:'#c9a468', brickD:'#96784a', beam:'#5ac9c9' },
  // country: warm morning
  { sky1:'#5ab0e8', sky2:'#cde8b0', wall:'#4a6e2d', wallD:'#37501f', brick:'#7aa844', brickD:'#5a7c33', beam:'#d6c97b' },
  // football: night game under the lights
  { sky1:'#0e1426', sky2:'#1d2a5e', wall:'#28356e', wallD:'#1d2650', brick:'#e07028', brickD:'#a85220', beam:'#e8b04a' },
  // wedding: bayside sunset
  { sky1:'#e88a5a', sky2:'#f4c9d4', wall:'#8a5a70', wallD:'#6e4258', brick:'#e8c9d4', brickD:'#c9a0b0', beam:'#ffffff' },
  // horse country: UK blue morning
  { sky1:'#2a52c9', sky2:'#9ec4f0', wall:'#233a8a', wallD:'#1a2c68', brick:'#3a5cc9', brickD:'#2b4496', beam:'#e8e8f2' },
  // med school: clean teal
  { sky1:'#1d4e58', sky2:'#7bd0d6', wall:'#265e66', wallD:'#1b4248', brick:'#3aa0ae', brickD:'#2b7580', beam:'#7bd0d6' },
  // kenwick: golden-hour neighborhood stroll
  { sky1:'#4a90d9', sky2:'#f4d9a8', wall:'#8a5a3e', wallD:'#6e4530', brick:'#c96a4a', brickD:'#a04e34', beam:'#e8d9b0' },
  // the kennel: crimson dark
  { sky1:'#120808', sky2:'#3a0e0e', wall:'#4f1a1a', wallD:'#381010', brick:'#8a3030', brickD:'#642222', beam:'#c96a6a' },
];
const LEVEL_BOOKS = LVL_META.map(() => []);
BOOKS.forEach((b, i) => LEVEL_BOOKS[b.l].push(i));
const TOTAL_BOOKS = BOOKS.length;
const TOTAL_LENGLE = BOOKS.filter(b => b.le).length;

// ---------------------------------------------------------- save
// Progress lives in memory for the CURRENT SESSION ONLY: unlocks and book
// counts carry between levels while playing, but closing or reloading the
// game starts completely fresh — previous playthroughs never carry over.
const CAGE_LEVELS = [0, 2, 6]; // G-Daddy & Pep (L1), CC & Uncle B + dogs (L3), the kids (L7)
let sessionSave = null;
function loadSave() {
  return sessionSave;
}
function nextResumeLevel(completed = G.completedLevels) {
  for (let i = 0; i < LVL_META.length - 1; i++) if (!completed.has(i)) return i;
  return LVL_META.length - 1;
}
function writeSave() {
  sessionSave = {
    level: nextResumeLevel(),
    collected: [...G.collected],
    completed: [...G.completedLevels].sort((a, b) => a - b),
    rescued: [...G.rescued].sort((a, b) => a - b),
  };
  G.saveCache = sessionSave;
}

// ---------------------------------------------------------- game state
const TILE = 16, GRAV = 0.38, JUMPV = -7.6, LEVEL_TIME = 120;
const MAX_HEARTS = 5; // Dr. Raven runs on coffee: five cups of health
const LEVEL_START_MINUTE = 18 * 60; // 6:00 PM; one game minute per real second
function formatLevelClock(remaining) {
  const elapsed = Math.max(0, Math.min(LEVEL_TIME, LEVEL_TIME - remaining));
  const totalMinutes = LEVEL_START_MINUTE + Math.floor(elapsed + 0.0001);
  const hour24 = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const hour12 = ((hour24 + 11) % 12) + 1;
  return hour12 + ':' + String(minute).padStart(2, '0') + ' PM';
}
const G = {
  state: 'title', // title, intro, play, inv, cleared, dead, timeup, ending
  level: 0,
  collected: new Set(),   // banked (completed levels)
  completedLevels: new Set(), // levels finished, including out of order
  runSet: new Set(),      // this level attempt
  order: [],              // collect order for inventory
  hearts: MAX_HEARTS,
  rescued: new Set(),     // cage levels where the family was freed
  ramona: false, // heart-loss immunity for the current level only
  time: LEVEL_TIME,
  superT: 0,
  powerBannerT: 0,
  powerFlashA: 0,
  powerLightningT: 0,
  powerStrikeX: 0,
  powerBookTitle: '',
  frame: 0,
  menuSel: 0,
  invScroll: 0,
  shake: 0,
  stateT: 0,
  clearStats: null,
  saveCache: null,
  levelSelectRun: false,
  tourMode: false, // "ending" cheat: picker shows every level + both endings
};
function applySave(save) {
  G.collected = new Set(save ? save.collected : []);
  G.order = save ? [...save.collected] : [];
  G.completedLevels = new Set(save ? save.completed : []);
  G.rescued = new Set(save ? save.rescued : []);
}
// The perfect ending: every book collected AND everyone rescued from Jack's cages.
function perfectRun() {
  return G.collected.size >= TOTAL_BOOKS && CAGE_LEVELS.every(i => G.rescued.has(i));
}
function finalBattleUnlocked() {
  for (let i = 0; i < LVL_META.length - 1; i++) if (!G.completedLevels.has(i)) return false;
  return true;
}
// Kenwick (L7) opens once the first six levels are beaten; Jack's Lair follows Kenwick.
function kenwickUnlocked() {
  for (let i = 0; i < 6; i++) if (!G.completedLevels.has(i)) return false;
  return true;
}
function levelLocked(i) {
  return (i === 6 && !kenwickUnlocked()) || (i === LVL_META.length - 1 && !finalBattleUnlocked());
}
let L = null; // current level data
const P = {   // player
  x: 60, y: 200, vx: 0, vy: 0, w: 14, h: 30,
  facing: 1, grounded: false, coyote: 0, jumpHeld: false,
  jumpCount: 0, iframes: 0, animT: 0,
  safeX: 60, safeY: 200,
};
let cam = 0;
let particles = [], popups = [], projs = [], lostBookFx = [], stinks = [];
let shotsUsed = 0, throwCool = 0;
function ammoLeft() { return Math.max(0, G.runSet.size - shotsUsed); }

function totalCollected() { return G.collected.size + G.runSet.size; }
function pcxOf() { return P.x + P.w / 2; }
function lengleCount() {
  let n = 0;
  for (const i of G.collected) if (BOOKS[i].le) n++;
  for (const i of G.runSet) if (BOOKS[i].le) n++;
  return n;
}

// ---------------------------------------------------------- level generation
function genLevel(idx) {
  const rnd = RNG(0xB00C + idx * 7919);
  const bookIdxs = LEVEL_BOOKS[idx].filter(i => !G.collected.has(i));
  const allIdxs = LEVEL_BOOKS[idx];
  const n = allIdxs.length;
  const widthPx = 700 + n * 34;
  const cols = Math.ceil(widthPx / TILE);
  const pal = LVL_PALS[idx];

  // terrain heightmap: groundRow per column (null = pit)
  const ground = new Array(cols).fill(16);
  let c = 10;
  let row = 16;
  while (c < cols - 14) {
    const seg = 8 + Math.floor(rnd() * 10);
    // choose next elevation
    const roll = rnd();
    if (roll < 0.18 + idx * 0.015 && c > 20) {
      // gap
      const gap = 2 + Math.floor(rnd() * (2 + Math.min(2, idx * 0.4)));
      for (let i = 0; i < gap && c < cols - 14; i++, c++) ground[c] = null;
      row = 16;
    } else {
      row = roll < 0.55 ? 16 : (roll < 0.8 ? 14 : 13);
    }
    for (let i = 0; i < seg && c < cols - 14; i++, c++) ground[c] = row;
  }
  for (; c < cols; c++) ground[c] = 16;

  // one-way bookshelf platforms
  const plats = [];
  for (let px = 14; px < cols - 16; px += 3 + Math.floor(rnd() * 6)) {
    if (rnd() < 0.42) {
      const below = ground[px] == null ? 16 : ground[px];
      const prow = Math.max(5, below - 3 - Math.floor(rnd() * 3));
      const pw = 3 + Math.floor(rnd() * 4);
      plats.push({ x: px * TILE, y: prow * TILE, w: pw * TILE });
      px += pw;
    }
  }

  // books
  const books = [];
  const lengleIdxs = bookIdxs.filter(i => BOOKS[i].le);
  const normalIdxs = bookIdxs.filter(i => !BOOKS[i].le);
  const startX = 190, endX = widthPx - 260;
  normalIdxs.forEach((bi, k) => {
    const bx = startX + (endX - startX) * (k / Math.max(1, normalIdxs.length - 1)) + (rnd() - .5) * 26;
    // find support surface near bx
    const col = Math.max(0, Math.min(cols - 1, Math.floor(bx / TILE)));
    const surfaces = [];
    if (ground[col] != null) surfaces.push(ground[col] * TILE);
    for (const p of plats) if (bx >= p.x - 8 && bx <= p.x + p.w + 8) surfaces.push(p.y);
    let by;
    if (surfaces.length === 0) by = 200 - rnd() * 60;                 // arc over a pit
    else {
      const s = surfaces[Math.floor(rnd() * surfaces.length)];
      by = s - 26 - rnd() * 42;
    }
    books.push({ i: bi, x: bx, y: Math.max(36, by), phase: rnd() * 6.28, got: false, gold: false, colIdx: bi % BOOK_COLORS.length });
  });
  lengleIdxs.forEach((bi, k) => {
    const bx = startX + (endX - startX) * ((k + .5) / lengleIdxs.length);
    const col = Math.max(0, Math.min(cols - 1, Math.floor(bx / TILE)));
    const s = ground[col] != null ? ground[col] * TILE : 256;
    books.push({ i: bi, x: bx, y: Math.max(40, s - 70 - rnd() * 20), phase: rnd() * 6.28, got: false, gold: true, colIdx: 0 });
  });

  // Three to five coffee breaks per chapter, spaced across solid ground.
  const coffees = [];
  const coffeeCount = 3 + Math.floor(rnd() * 3);
  for (let k = 0; k < coffeeCount; k++) {
    const ratio = (k + 1) / (coffeeCount + 1);
    const desired = Math.floor((startX + (endX - startX) * ratio + (rnd() - 0.5) * 180) / TILE);
    let col = -1;
    for (let offset = 0; offset < 36 && col < 0; offset++) {
      const right = Math.min(cols - 18, desired + offset);
      const left = Math.max(12, desired - offset);
      if (ground[right] != null) col = right;
      else if (ground[left] != null) col = left;
    }
    if (col >= 0) {
      coffees.push({
        x: col * TILE + 8,
        y: ground[col] * TILE - SPR.coffee.height - 2,
        phase: rnd() * 6.28,
        got: false,
      });
    }
  }

  // enemies
  const enemies = [];
  const eCount = Math.round(5 + idx * 1.7 + n / 45);
  // hometown hazards: jellyfish on the gulf beach, horses in Wilmore, crimson
  // elephants in Auburn, question-hungry med students at UK Medical School
  const types = idx === 0 ? ['blot', 'jelly', 'moth', 'jelly']
    : idx === 1 ? ['blot', 'horse', 'moth', 'horse']
    : idx === 2 ? ['blot', 'elephant', 'moth', 'elephant']
    : idx === 5 ? ['blot', 'student', 'moth', 'student']
    : idx === 6 ? ['blot', 'skunk', 'moth', 'skunk']
    : ['blot', 'env', 'moth'];
  for (let k = 0; k < eCount; k++) {
    const ex = 420 + (widthPx - 750) * (k / Math.max(1, eCount - 1)) + (rnd() - .5) * 120;
    const type = types[Math.floor(rnd() * types.length)];
    const col = Math.max(0, Math.min(cols - 1, Math.floor(ex / TILE)));
    const gy = ground[col] != null ? ground[col] * TILE : 256;
    enemies.push({
      type, ax: ex, ay: Math.max(60, gy - 60 - rnd() * 70),
      x: ex, y: 0, t: rnd() * 200, alive: true,
      speed: 1 + idx * 0.07,
      st: 'hover', sx: 0, sy: 0, cool: 0,
      dir: rnd() < 0.5 ? -1 : 1, // ground enemies patrol
    });
  }

  // Jack the Dog — guards the exit, faster every level.
  // Final level: twice as tall, extra hearts, and he EATS books.
  const giant = idx === LVL_META.length - 1;
  const hp = giant ? 8 : 3 + Math.floor(idx / 4);
  const boss = {
    st: 'wait', hp, maxHp: hp,
    giant, scale: giant ? 2 : 1, belly: [], eatT: 0,
    x: widthPx - 200, y: -60, ax: widthPx - 200, ay: giant ? 110 : 130,
    t: 0, inv: 0, cool: 90, diveT: 0, sx: 0, sy: 0, spin: 0,
    dashSpeed: giant ? 3.4 : 2.1 + idx * 0.32,
    dashCool: giant ? 42 : Math.max(35, 85 - idx * 6),
    drift: giant ? 1.4 : 0.6 + idx * 0.12,
  };

  // level 7: the kids locked in Jack's cage by the door
  // level 1 (Loxley): G-Daddy & Pep — Dr. Raven's parents — in a kennel at the end
  // level 3 (Auburn): CC & Uncle B with their dachshunds, Butter & Bacon
  const cage = idx === 6
    ? { x: widthPx - 160, y: 256 - 32, w: 46, h: 32, open: false }
    : idx === 0
    ? { x: widthPx - 160, y: 256 - 32, w: 46, h: 32, open: false, parents: true }
    : idx === 2
    ? { x: widthPx - 160, y: 256 - 32, w: 60, h: 32, open: false, auburn: true }
    : null;

  // level 4 (the wedding): Donnie appears once Jack is beaten
  const donnie = idx === 3
    ? { x: widthPx - 128, st: 'wait', t: 0, met: false, sayT: 0 }
    : null;

  // themed scenery props on solid ground
  const props = [];
  let pc = 6;
  while (pc < cols - 8) {
    pc += 9 + Math.floor(rnd() * 12);
    if (pc >= cols - 8 || ground[pc] == null || ground[pc + 1] == null) continue;
    props.push({ kind: Math.floor(rnd() * 3), x: pc * TILE + 8, gy: ground[pc] * TILE, theme: THEMES[idx].id, seed: rnd() });
  }

  return {
    idx, pal, cols, widthPx, ground, plats, books, coffees, enemies, boss, cage, donnie, props,
    doorX: widthPx - 70, doorY: 256 - 34,
    bg: makeBgLayers(pal, idx),
  };
}

// pixel scenery per theme: 3 prop kinds each, drawn standing on the ground line
function drawProp(p) {
  const x = Math.floor(p.x), gy = p.gy;
  const k = p.kind;
  switch (p.theme) {
    case 'beach':
      if (k === 0) { // palm tree
        ctx.fillStyle = '#8a5a2e';
        ctx.fillRect(x - 2, gy - 34, 4, 34); ctx.fillRect(x - 4, gy - 24, 2, 12);
        ctx.fillStyle = '#2e8a3a';
        ctx.fillRect(x - 14, gy - 40, 12, 4); ctx.fillRect(x + 2, gy - 40, 12, 4);
        ctx.fillRect(x - 10, gy - 44, 20, 4); ctx.fillRect(x - 3, gy - 47, 6, 4);
        ctx.fillStyle = '#c9a85e'; ctx.fillRect(x - 3, gy - 38, 6, 4); // coconuts
      } else if (k === 1) { // umbrella
        ctx.fillStyle = '#e8e4da'; ctx.fillRect(x - 1, gy - 26, 2, 26);
        ctx.fillStyle = '#d93636';
        ctx.fillRect(x - 12, gy - 26, 24, 4); ctx.fillRect(x - 8, gy - 30, 16, 4);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, gy - 30, 4, 4); ctx.fillRect(x - 12, gy - 26, 4, 4); ctx.fillRect(x + 4, gy - 26, 4, 4);
      } else { // sandcastle
        ctx.fillStyle = '#d4bc72';
        ctx.fillRect(x - 10, gy - 10, 20, 10); ctx.fillRect(x - 8, gy - 16, 6, 6); ctx.fillRect(x + 2, gy - 16, 6, 6);
        ctx.fillStyle = '#c9a85e'; ctx.fillRect(x - 8, gy - 18, 2, 2); ctx.fillRect(x + 6, gy - 18, 2, 2);
        ctx.fillStyle = '#3e3a46'; ctx.fillRect(x - 2, gy - 6, 4, 6);
      }
      break;
    case 'country':
    case 'horse':
      if (k === 0) { // white plank fence
        ctx.fillStyle = '#f0f0f4';
        ctx.fillRect(x - 16, gy - 14, 3, 14); ctx.fillRect(x - 1, gy - 14, 3, 14); ctx.fillRect(x + 14, gy - 14, 3, 14);
        ctx.fillRect(x - 16, gy - 12, 33, 2); ctx.fillRect(x - 16, gy - 6, 33, 2);
      } else if (k === 1 && p.theme === 'horse') { // horse!
        ctx.fillStyle = '#6e4522';
        ctx.fillRect(x - 12, gy - 16, 22, 9);                       // body
        ctx.fillRect(x - 12, gy - 7, 3, 7); ctx.fillRect(x - 4, gy - 7, 3, 7);
        ctx.fillRect(x + 4, gy - 7, 3, 7); ctx.fillRect(x + 8, gy - 7, 3, 7); // legs
        ctx.fillRect(x + 8, gy - 22, 5, 8);                         // neck
        ctx.fillRect(x + 10, gy - 25, 8, 5);                        // head
        ctx.fillStyle = '#3e2a14';
        ctx.fillRect(x + 7, gy - 24, 3, 10);                        // mane
        ctx.fillRect(x - 15, gy - 15, 3, 8);                        // tail
        ctx.fillStyle = '#1c1c24'; ctx.fillRect(x + 15, gy - 24, 2, 2); // eye
      } else if (k === 1) { // hay bale
        ctx.fillStyle = '#d4b23e';
        ctx.fillRect(x - 9, gy - 12, 18, 12);
        ctx.fillStyle = '#b8962e';
        ctx.fillRect(x - 9, gy - 8, 18, 1); ctx.fillRect(x - 9, gy - 4, 18, 1);
        ctx.fillRect(x - 3, gy - 12, 1, 12); ctx.fillRect(x + 3, gy - 12, 1, 12);
      } else { // trough / mailbox
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x - 1, gy - 16, 3, 16);
        ctx.fillStyle = '#4a7ab5'; ctx.fillRect(x - 7, gy - 22, 15, 7);
        ctx.fillStyle = '#3a5f8c'; ctx.fillRect(x - 7, gy - 22, 15, 2);
      }
      break;
    case 'football':
      if (k === 0) { // goal post
        ctx.fillStyle = '#ffd23e';
        ctx.fillRect(x - 1, gy - 30, 3, 30);
        ctx.fillRect(x - 12, gy - 32, 27, 3);
        ctx.fillRect(x - 12, gy - 48, 3, 16); ctx.fillRect(x + 12, gy - 48, 3, 16);
      } else if (k === 1) { // football on tee
        ctx.fillStyle = '#8a4a1e';
        ctx.fillRect(x - 6, gy - 8, 12, 6); ctx.fillRect(x - 8, gy - 6, 16, 2);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, gy - 6, 6, 1);
      } else { // pylon
        ctx.fillStyle = '#ff7028'; ctx.fillRect(x - 3, gy - 10, 7, 10);
        ctx.fillStyle = '#ff9858'; ctx.fillRect(x - 3, gy - 10, 3, 10);
      }
      break;
    case 'wedding':
      if (k === 0) { // wedding arch
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 14, gy - 34, 4, 34); ctx.fillRect(x + 10, gy - 34, 4, 34);
        ctx.fillRect(x - 14, gy - 38, 28, 4);
        ctx.fillStyle = '#e88aa8';
        ctx.fillRect(x - 16, gy - 36, 4, 4); ctx.fillRect(x + 12, gy - 36, 4, 4);
        ctx.fillRect(x - 4, gy - 40, 4, 4); ctx.fillRect(x - 10, gy - 22, 3, 3); ctx.fillRect(x + 8, gy - 18, 3, 3);
        ctx.fillStyle = '#3fae6a'; ctx.fillRect(x - 14, gy - 30, 2, 8); ctx.fillRect(x + 12, gy - 26, 2, 8);
      } else if (k === 1) { // heart balloon
        ctx.fillStyle = '#c9c9d4'; ctx.fillRect(x, gy - 22, 1, 22);
        ctx.fillStyle = '#ff4560';
        ctx.fillRect(x - 4, gy - 30, 4, 3); ctx.fillRect(x + 1, gy - 30, 4, 3);
        ctx.fillRect(x - 5, gy - 28, 11, 4); ctx.fillRect(x - 3, gy - 24, 7, 2); ctx.fillRect(x - 1, gy - 22, 3, 1);
      } else { // flowers
        ctx.fillStyle = '#3fae6a'; ctx.fillRect(x - 1, gy - 8, 2, 8); ctx.fillRect(x - 6, gy - 6, 2, 6); ctx.fillRect(x + 4, gy - 7, 2, 7);
        ctx.fillStyle = '#ff9ec0'; ctx.fillRect(x - 3, gy - 12, 5, 5);
        ctx.fillStyle = '#ffe45a'; ctx.fillRect(x - 8, gy - 9, 4, 4); ctx.fillRect(x + 3, gy - 10, 4, 4);
      }
      break;
    case 'medical':
      if (k === 0) { // red cross sign
        ctx.fillStyle = '#8fb0b8'; ctx.fillRect(x - 1, gy - 30, 3, 30);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 8, gy - 44, 17, 17);
        ctx.fillStyle = '#d93636'; ctx.fillRect(x - 2, gy - 41, 5, 11); ctx.fillRect(x - 5, gy - 38, 11, 5);
      } else if (k === 1) { // IV stand
        ctx.fillStyle = '#aec8ce';
        ctx.fillRect(x - 1, gy - 32, 2, 32); ctx.fillRect(x - 6, gy - 32, 12, 2);
        ctx.fillStyle = '#cdeef5'; ctx.fillRect(x - 8, gy - 30, 5, 8);
        ctx.fillStyle = '#4a90d9'; ctx.fillRect(x - 8, gy - 26, 5, 4);
      } else { // pill bottle
        ctx.fillStyle = '#e8862e'; ctx.fillRect(x - 5, gy - 10, 10, 10);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 5, gy - 13, 10, 3); ctx.fillRect(x - 3, gy - 7, 6, 4);
      }
      break;
    case 'kenwick':
      if (k === 0) { // leafy street tree
        ctx.fillStyle = '#6e4522';
        ctx.fillRect(x - 2, gy - 30, 5, 30);
        ctx.fillStyle = '#3f8c33';
        ctx.fillRect(x - 12, gy - 42, 25, 12);
        ctx.fillRect(x - 8, gy - 48, 17, 8);
        ctx.fillStyle = '#4fa83f';
        ctx.fillRect(x - 10, gy - 40, 8, 6); ctx.fillRect(x + 3, gy - 46, 7, 6);
      } else if (k === 1) { // mailbox with the flag up
        ctx.fillStyle = '#54381f'; ctx.fillRect(x - 1, gy - 16, 3, 16);
        ctx.fillStyle = '#4a5a6e'; ctx.fillRect(x - 7, gy - 23, 15, 8);
        ctx.fillStyle = '#3a4858'; ctx.fillRect(x - 7, gy - 23, 15, 2);
        ctx.fillStyle = '#d93636'; ctx.fillRect(x + 6, gy - 27, 2, 5);
      } else { // fire hydrant
        ctx.fillStyle = '#d93636';
        ctx.fillRect(x - 4, gy - 10, 9, 10); ctx.fillRect(x - 2, gy - 13, 5, 3);
        ctx.fillRect(x - 6, gy - 8, 13, 3);
        ctx.fillStyle = '#ffe45a'; ctx.fillRect(x - 1, gy - 12, 3, 2);
      }
      break;
    default: // kennel
      if (k === 0) { // dog house
        ctx.fillStyle = '#a33327'; ctx.fillRect(x - 13, gy - 20, 26, 20);
        ctx.fillStyle = '#7d2015'; ctx.fillRect(x - 15, gy - 26, 30, 6);
        ctx.fillStyle = '#1c1418'; ctx.fillRect(x - 5, gy - 12, 10, 12);
        ctx.fillStyle = '#ffe45a'; ctx.fillRect(x - 4, gy - 24, 8, 3);
      } else if (k === 1) { // bone
        ctx.fillStyle = '#e8e4da';
        ctx.fillRect(x - 7, gy - 5, 14, 3);
        ctx.fillRect(x - 9, gy - 7, 3, 3); ctx.fillRect(x - 9, gy - 3, 3, 3);
        ctx.fillRect(x + 6, gy - 7, 3, 3); ctx.fillRect(x + 6, gy - 3, 3, 3);
      } else { // food bowl
        ctx.fillStyle = '#d93636'; ctx.fillRect(x - 8, gy - 5, 16, 5);
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x - 5, gy - 7, 10, 3);
        ctx.fillStyle = '#ffffff'; drawText('JACK', x - 7, gy - 4, 1, '#ffffff');
      }
      break;
  }
}

// Kenwick's finish line: Wilsons Meat & Groceries. A brick storefront wraps
// the exit door, and the big two-panel pole sign stands over the kids' cage.
function drawWilsons() {
  const cg = L.cage;
  const px = cg.x + cg.w / 2;
  // storefront around the exit door
  const fx = L.doorX - 28;
  ctx.fillStyle = '#a04e34'; ctx.fillRect(fx, 158, 96, 98);            // brick face
  ctx.fillStyle = '#8a3f28';
  for (let by = 162; by < 256; by += 8)
    for (let bx = fx + (by % 16 ? 0 : 6); bx < fx + 96; bx += 12) ctx.fillRect(bx, by, 5, 2);
  ctx.fillStyle = '#f2ecd8'; ctx.fillRect(fx + 4, 166, 88, 12);        // fascia board
  drawTextC('WILSONS GROCERY', fx + 48, 170, 1, '#2a2018');
  for (let a = 0; a < 6; a++) {                                        // striped awning
    ctx.fillStyle = a % 2 ? '#f2ecd8' : '#a33327';
    ctx.fillRect(L.doorX - 6 + a * 6, 182, 6, 8);
  }
  ctx.fillStyle = '#c9dce8'; ctx.fillRect(fx + 8, 190, 24, 32);        // display window
  ctx.fillStyle = '#8a5a2e'; ctx.fillRect(fx + 12, 208, 8, 6); ctx.fillRect(fx + 20, 210, 8, 4); // hams
  // --- the big pole sign, the family right underneath ---
  ctx.fillStyle = '#8a8a92'; ctx.fillRect(px - 2, 112, 4, 112);        // pole
  ctx.strokeStyle = '#8a8a92'; ctx.lineWidth = 1;                       // guy wires
  ctx.beginPath();
  ctx.moveTo(px, 112); ctx.lineTo(px - 44, 122);
  ctx.moveTo(px, 112); ctx.lineTo(px + 44, 122);
  ctx.stroke();
  ctx.fillStyle = '#54432e'; ctx.fillRect(px - 46, 118, 92, 44);       // main panel
  ctx.fillStyle = '#f2ecd8'; ctx.fillRect(px - 44, 120, 88, 40);
  drawTextC('WILSONS', px, 124, 2, '#2a2018');
  drawTextC('MEAT & GROCERIES', px, 138, 1, '#2a2018');
  ctx.fillStyle = '#c9553e'; ctx.fillRect(px - 34, 144, 68, 1);        // red rule
  drawTextC('COOKED COUNTRY HAMS', px, 148, 1, '#2a2018');
  ctx.fillStyle = '#54432e'; ctx.fillRect(px - 46, 164, 92, 26);       // lower panel
  ctx.fillStyle = '#f2ecd8'; ctx.fillRect(px - 44, 166, 88, 22);
  drawText('HOT', px - 40, 169, 1, '#d93636');
  drawText('LUNCH MON-FRI', px - 24, 169, 1, '#2a2018');
  drawTextC('SOUPS - SANDWICHES', px, 179, 1, '#c9553e');
}

// pre-rendered, theme-specific background layer (tiles horizontally, parallax)
function makeBgLayers(pal, idx) {
  const rnd = RNG(0xFACE + idx);
  const theme = THEMES[idx].id;
  const far = document.createElement('canvas');
  far.width = 512; far.height = VH;
  const g = far.getContext('2d');
  const cloud = (cx, cy, s) => {
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillRect(cx, cy + 3 * s, 16 * s, 4 * s);
    g.fillRect(cx + 3 * s, cy, 7 * s, 4 * s);
    g.fillRect(cx + 10 * s, cy + 1 * s, 5 * s, 3 * s);
  };
  if (theme === 'beach') {
    g.fillStyle = '#ffe45a'; g.beginPath(); g.arc(200, 45, 16, 0, 6.29); g.fill(); // sun
    cloud(30, 30, 1); cloud(130, 60, 1);
    g.fillStyle = '#2e86c1'; g.fillRect(0, 150, 512, 70);   // gulf
    g.fillStyle = '#3a9ad4'; g.fillRect(0, 150, 512, 8);
    g.fillStyle = '#cdeef5';
    for (let i = 0; i < 26; i++) g.fillRect(Math.floor(rnd() * 506), 160 + Math.floor(rnd() * 55), 5, 1);
    g.fillStyle = '#f6e8b0'; g.fillRect(0, 218, 512, 70);   // distant shore
  } else if (theme === 'country' || theme === 'horse') {
    cloud(40, 34, 1); cloud(170, 50, 1);
    g.fillStyle = theme === 'horse' ? '#4a8c2e' : '#4f9c3f'; // rolling hills
    g.beginPath(); g.arc(60, 260, 110, 0, 6.29); g.fill();
    g.beginPath(); g.arc(210, 275, 130, 0, 6.29); g.fill();
    g.fillStyle = '#3f7c33';
    g.beginPath(); g.arc(140, 300, 130, 0, 6.29); g.fill();
    // barn
    g.fillStyle = '#a33327'; g.fillRect(96, 156, 44, 34);
    g.fillStyle = '#7d2015'; g.fillRect(92, 148, 52, 10);
    g.fillStyle = '#ffffff'; g.fillRect(112, 166, 12, 24);
    g.fillStyle = '#5c1810'; g.fillRect(114, 170, 8, 20);
    // white plank fence on the hilltops
    g.fillStyle = '#f0f0f4';
    for (let fx = 0; fx < 512; fx += 18) g.fillRect(fx, 196, 2, 12);
    g.fillRect(0, 198, 512, 2); g.fillRect(0, 204, 512, 2);
  } else if (theme === 'football') {
    // stadium stands under the lights
    g.fillStyle = '#3a3a48'; g.fillRect(0, 40, 512, 120);
    for (let r = 0; r < 7; r++) {
      g.fillStyle = r % 2 ? '#4a4a5c' : '#42424f';
      g.fillRect(0, 48 + r * 14, 512, 8);
      g.fillStyle = '#8a8a9e';
      for (let sx = 3 + (r % 2) * 4; sx < 512; sx += 8) g.fillRect(sx, 50 + r * 14, 2, 3);
    }
    for (let lx = 60; lx < 512; lx += 160) { // floodlights
      g.fillStyle = '#55555f'; g.fillRect(lx, 8, 4, 34);
      g.fillStyle = '#fff6c0'; g.fillRect(lx - 8, 2, 20, 8);
    }
    g.fillStyle = '#e8f0e8'; g.fillRect(0, 160, 512, 4); // field wall
    g.fillStyle = '#e07028'; g.fillRect(0, 164, 512, 10); // auburn banner
  } else if (theme === 'wedding') {
    cloud(60, 36, 1); cloud(190, 26, 1);
    g.fillStyle = '#e8a0b8'; g.beginPath(); g.arc(60, 60, 14, 0, 6.29); g.fill(); // low sun
    g.fillStyle = '#5a9ac9'; g.fillRect(0, 150, 512, 60);  // mobile bay
    g.fillStyle = '#cdeef5';
    for (let i = 0; i < 18; i++) g.fillRect(Math.floor(rnd() * 506), 158 + Math.floor(rnd() * 44), 5, 1);
    g.fillStyle = '#f6e8d8'; g.fillRect(0, 208, 512, 80);  // white sand shore
    // string lights
    g.fillStyle = '#8a6a52';
    g.fillRect(20, 90, 3, 120); g.fillRect(488, 90, 3, 120);
    for (let bx = 22; bx < 490; bx += 10) {
      g.fillStyle = '#6e5a48'; g.fillRect(bx, 98 + Math.floor(Math.sin(bx * .1) * 4), 10, 1);
      g.fillStyle = ['#ffe45a', '#ff9ec0', '#a0e8ff'][Math.floor(bx / 10) % 3];
      g.fillRect(bx + 4, 100 + Math.floor(Math.sin(bx * .1) * 4), 3, 4);
    }
  } else if (theme === 'medical') {
    // hospital corridor wall
    g.fillStyle = '#e4f0f2'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#cfe0e4'; g.fillRect(0, 150, 512, 138);
    g.fillStyle = '#8fb0b8'; g.fillRect(0, 148, 512, 4);
    // red cross sign + windows
    g.fillStyle = '#ffffff'; g.fillRect(112, 52, 32, 32);
    g.fillStyle = '#d93636'; g.fillRect(124, 58, 8, 20); g.fillRect(118, 64, 20, 8);
    g.fillStyle = '#9ec8d0'; g.fillRect(30, 50, 30, 40); g.fillRect(196, 50, 30, 40);
    g.fillStyle = '#b8dce2'; g.fillRect(32, 52, 12, 36);
    // EKG line
    g.fillStyle = '#3fae6a';
    let ey = 120;
    for (let ex = 0; ex < 512; ex += 2) {
      const m = ex % 64;
      ey = m < 40 ? 120 : m < 44 ? 120 - (m - 40) * 6 : m < 52 ? 96 + (m - 44) * 6 : 120;
      g.fillRect(ex, ey, 2, 2);
    }
  } else if (theme === 'kenwick') {
    // a friendly Lexington neighborhood at golden hour
    cloud(50, 30, 1); cloud(180, 46, 1);
    g.fillStyle = '#ffd98a'; g.beginPath(); g.arc(210, 40, 13, 0, 6.29); g.fill(); // low sun
    g.fillStyle = '#3f7c33'; // distant tree line
    for (let tx = 0; tx < 512; tx += 46) { g.beginPath(); g.arc(tx + 20, 190, 24, 0, 6.29); g.fill(); }
    g.fillStyle = '#55803a'; g.fillRect(0, 196, 512, 30); // hedges
    // a row of front-porch houses
    const hues = [['#c9d4e8', '#8a99b8'], ['#e8d4a8', '#b8a578'], ['#c9e0c0', '#93b08a'], ['#e8c0b8', '#b89088']];
    for (let i = 0; i < 4; i++) {
      const hx = 20 + i * 128, wallC = hues[i][0], roofC = hues[i][1];
      g.fillStyle = wallC; g.fillRect(hx, 168, 64, 58);          // house
      g.fillStyle = roofC;                                        // gable roof
      g.beginPath(); g.moveTo(hx - 8, 170); g.lineTo(hx + 32, 142); g.lineTo(hx + 72, 170); g.closePath(); g.fill();
      g.fillStyle = '#ffd98a';                                    // warm windows
      g.fillRect(hx + 8, 180, 12, 14); g.fillRect(hx + 44, 180, 12, 14);
      g.fillStyle = '#54381f'; g.fillRect(hx + 26, 196, 12, 30);  // door
      g.fillStyle = '#f0f0f4'; g.fillRect(hx - 2, 210, 68, 3);    // porch rail
    }
    // telephone poles with sagging lines (one of these holds up Wilsons' sign)
    g.fillStyle = '#54432e';
    for (let px = 96; px < 512; px += 256) { g.fillRect(px, 96, 4, 130); g.fillRect(px - 10, 102, 24, 3); }
    g.strokeStyle = '#3a3430'; g.lineWidth = 1;
    g.beginPath();
    for (let wx = -160; wx < 512; wx += 256) {
      g.moveTo(wx + 98, 104); g.quadraticCurveTo(wx + 226, 122, wx + 354, 104);
    }
    g.stroke();
  } else { // kennel
    g.fillStyle = '#3a3540'; g.fillRect(0, 0, 512, 288);
    g.fillStyle = '#2e2a36';
    for (let y = 0; y < VH; y += 12) {
      g.fillRect(0, y, 512, 2);
      for (let x = (y % 24) ? 14 : 0; x < 512; x += 28) g.fillRect(x, y, 2, 12);
    }
    // chain-link fence panel
    g.strokeStyle = '#6e6a78'; g.lineWidth = 1;
    g.beginPath();
    for (let d = -60; d < 560; d += 12) {
      g.moveTo(d, 60); g.lineTo(d + 90, 150);
      g.moveTo(d + 90, 60); g.lineTo(d, 150);
    }
    g.stroke();
    g.fillStyle = '#55515e'; g.fillRect(0, 56, 512, 4); g.fillRect(0, 150, 512, 4);
    // hanging leashes and a warning sign
    g.fillStyle = '#a33327'; g.fillRect(150, 76, 34, 24);
    g.fillStyle = '#ffe45a'; g.fillRect(153, 79, 28, 18);
    g.fillStyle = '#1c1c24';
    g.fillRect(156, 84, 22, 2); g.fillRect(156, 90, 16, 2);
  }
  return { far, mid: null };
}

// ---------------------------------------------------------- level lifecycle
function startLevel(idx, freshHearts, force) {
  if (!force && levelLocked(idx)) {
    G.levelSelectRun = false;
    openLevelSelect();
    return;
  }
  G.level = idx;
  G.runSet = new Set();
  G.order = G.order.filter(i => G.collected.has(i)); // drop books from failed runs
  G.time = LEVEL_TIME;
  G.superT = 0;
  G.powerBannerT = 0; G.powerFlashA = 0; G.powerLightningT = 0; G.powerBookTitle = '';
  if (freshHearts) G.hearts = MAX_HEARTS;
  G.ramona = false; // the cheat never carries over — retype it each level
  L = genLevel(idx);
  P.x = 60; P.y = 180; P.vx = 0; P.vy = 0;
  P.safeX = 60; P.safeY = 180;
  P.iframes = 0; P.facing = 1; P.grounded = false; P.jumpCount = 0;
  cam = 0;
  particles = []; popups = []; projs = []; lostBookFx = []; stinks = [];
  shotsUsed = 0; throwCool = 0;
  for (const b of L.books) loadCover(b.i); // fetch real covers up front
  // ARCADE BUILD: show a loading bar while this level's covers download, so the
  // Pi does all the image work before play starts instead of stuttering during
  // the first ~10s of the level. updateLoading advances to 'intro' when done.
  G.loadStart = performance.now();
  G.loadDone = 0;
  G.loadTotal = L.books.length;
  G.state = 'loading';
  G.stateT = 0;
  audio.stop();
}

function completeLevel() {
  const completedLevel = G.level;
  for (const i of G.runSet) G.collected.add(i);
  G.runSet = new Set();
  if (L.cage && L.cage.open) G.rescued.add(completedLevel);
  const nBooksHere = LEVEL_BOOKS[completedLevel].length;
  const gotHere = LEVEL_BOOKS[completedLevel].filter(i => G.collected.has(i)).length;
  G.clearStats = { got: gotHere, of: nBooksHere, clock: formatLevelClock(G.time) };
  G.completedLevels.add(completedLevel);
  writeSave();
  audio.stop();
  audio.sfx('clear');
  if (completedLevel === LVL_META.length - 1) {
    if (perfectRun()) startPerfect();
    else startCutscene();
  } else {
    if (!G.levelSelectRun) G.level = completedLevel + 1;
    G.state = 'cleared';
    G.stateT = 0;
  }
}

// ---------------------------------------------------------- physics helpers
function groundTopAt(col) {
  if (!L || col < 0 || col >= L.cols) return 16 * TILE;
  const r = L.ground[col];
  return r == null ? null : r * TILE;
}
const READING_BREAK_MESSAGES = [
  'THE INK BLOTS GOT THE BETTER OF HER.',
  'SHE PAUSED TO FIND HER PLACE.',
  'EVEN SUPER READERS NEED A QUIET MINUTE.',
  'HER BOOKMARK CALLED FOR A SHORT BREAK.',
  'THE NEXT CHAPTER CAN WAIT JUST A MOMENT.',
  'SHE STOPPED FOR TEA AND A FRESH START.',
  'TOO MANY PLOT TWISTS AT ONCE.',
  'THE LIBRARY LIGHTS FLICKERED.',
  'SHE TOOK A MOMENT TO REFOCUS.',
  'THIS CHAPTER NEEDS A QUICK REREAD.',
  'JACK HID THE NEXT PAGE.',
];
let readingBreakMessage = -1;
function beginReadingBreak() {
  let next = Math.floor(Math.random() * READING_BREAK_MESSAGES.length);
  if (next === readingBreakMessage) next = (next + 1) % READING_BREAK_MESSAGES.length;
  readingBreakMessage = next;
  G.state = 'dead'; G.stateT = 0;
  audio.stop(); audio.sfx('gameover');
}
// themed defeat quips — Wilmore's horses answer for the B- in Horseback
// Riding; Auburn's crimson elephants get sent home with the classics
const HORSE_QUIPS = [
  'THAT WAS FOR THE B- IN HORSEBACK RIDING!',
  'SUMMA CUM LAUDE IF NOT FOR YOU!',
  'THE ONE B- ON THE TRANSCRIPT!',
  'STILL BITTER ABOUT THAT GRADE!',
  'THE HORSE HELD A GRUDGE. SO DID SHE.',
];
const ELEPHANT_QUIPS = ['WAR EAGLE!', 'KICK SIX!', 'PUNT BAMA, PUNT!'];
function defeatQuip(e) {
  if (e.type === 'horse') return HORSE_QUIPS[Math.floor(Math.random() * HORSE_QUIPS.length)];
  if (e.type === 'elephant') return ELEPHANT_QUIPS[Math.floor(Math.random() * ELEPHANT_QUIPS.length)];
  return null;
}
// what the UK med students want to know (each bump costs 10 minutes)
const STUDENT_QUESTIONS = [
  'DR. RAVEN, WILL THIS BE ON THE TEST?',
  'CAN YOU SIGN MY TEXTBOOK?',
  'IS COFFEE A FOOD GROUP?',
  'HOW MANY BONES ARE IN THE HAND AGAIN?',
  'WHAT DOES THE SPLEEN EVEN DO?',
  'CAN I SHADOW YOU... FOREVER?',
  'IS IT NORMAL TO CRY IN ANATOMY LAB?',
  'QUICK QUESTION... OK, ELEVEN QUESTIONS.',
];
function loseRunBooks(count) {
  const lost = [];
  for (let oi = G.order.length - 1; oi >= 0 && lost.length < count; oi--) {
    const id = G.order[oi];
    if (!G.runSet.has(id)) continue;
    G.runSet.delete(id);
    G.order.splice(oi, 1);
    const book = L.books.find(b => b.i === id);
    lost.push({ id, book });
  }
  for (let i = 0; i < lost.length; i++) {
    const { id, book } = lost[i];
    lostBookFx.push({
      x: P.x + P.w / 2, y: P.y + 7,
      vx: (i - (lost.length - 1) / 2) * 1.8 + (Math.random() - 0.5) * 0.5,
      vy: -3.4 - Math.random() * 0.8,
      rot: (Math.random() - 0.5) * 0.8,
      vr: (i % 2 ? 1 : -1) * (0.16 + Math.random() * 0.08),
      life: 90,
      cv: coverOf(id),
      colIdx: book ? book.colIdx : id % BOOK_COLORS.length,
      gold: book ? book.gold : BOOKS[id].le,
    });
  }
  return lost.length;
}
function activateRamona() {
  G.ramona = true;
  audio.sfx('lengle');
  addPopup('RAMONA IS WATCHING OVER YOU!', P.x + P.w / 2, P.y - 14, '#ffd23e');
}
function hurt(px) {
  if (P.iframes > 0 || G.superT > 0) return;
  if (!G.ramona) G.hearts--;
  // collected books stay collected — hits only cost coffee
  P.iframes = 100;
  P.vx = (P.x + P.w / 2 < px ? -3 : 3);
  P.vy = -4.2;
  G.shake = 12;
  audio.sfx('hurt');
  if (G.hearts <= 0) {
    beginReadingBreak();
  }
}
function bossHit() {
  const bz = L.boss;
  if (bz.inv > 0 || bz.st === 'dead') return;
  bz.hp--;
  bz.inv = 70;
  audio.sfx('bosshit');
  spawnBurst(bz.x, bz.y, '#ffffff', 14, 2.5);
  G.shake = 8;
  // every hit knocks the eaten books back out of giant Jack's belly
  if (bz.belly.length) {
    for (const b of bz.belly) {
      b.eaten = false;
      b.x = bz.x + (Math.random() - .5) * 90;
      b.y = Math.max(40, Math.min(200, bz.y + (Math.random() - .5) * 60));
      b.phase = Math.random() * 6.28;
    }
    addPopup('THE BOOKS ESCAPE!', bz.x, bz.y - 44, '#5aff8f');
    bz.belly = [];
  }
  if (bz.hp <= 0) {
    bz.st = 'dead';
    audio.sfx('bossdie');
    spawnBurst(bz.x, bz.y, '#ffe45a', 26, 3.5);
    addPopup('JACK THE DOG FLEES! BAD DOG!', bz.x, bz.y - 24, '#5aff8f');
    addPopup('THE DOOR IS OPEN!', L.doorX + 11, L.doorY - 20, '#ffe45a');
  } else {
    addPopup('GRRR! ' + bz.hp + ' TO GO', bz.x, bz.y - 24, '#ff5a5a');
  }
}
function pitFall() {
  if (!G.ramona) G.hearts--;
  audio.sfx('hurt');
  G.shake = 12;
  if (G.hearts <= 0) {
    beginReadingBreak();
    return;
  }
  P.x = P.safeX; P.y = P.safeY - 4; P.vx = 0; P.vy = 0;
  P.iframes = 110; P.jumpCount = 0;
}
function spawnBurst(x, y, color, n, spd) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.28, s = (spd || 2) * (0.4 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1, life: 30 + Math.random() * 20, color, g: .1 });
  }
}
function addPopup(text, x, y, color) {
  popups.push({ text, x, y, life: 80, color });
}
// a tiny headstone that floats up where a brave skunk fell
function addGrave(x, y) {
  popups.push({ grave: true, x, y: y - 8, life: 110 });
}

// ---------------------------------------------------------- update: play
function updatePlay() {
  G.frame++;
  const superOn = G.superT > 0;
  if (superOn) G.superT--;
  if (G.powerBannerT > 0) G.powerBannerT--;
  if (G.powerLightningT > 0) G.powerLightningT--;
  G.powerFlashA *= 0.88;
  if (P.iframes > 0) P.iframes--;

  // timer
  G.time -= 1 / 60;
  if (G.time <= 0) {
    G.time = 0;
    G.state = 'timeup'; G.stateT = 0;
    audio.stop(); audio.sfx('gameover');
    return;
  }
  if (G.time <= 10 && Math.abs(G.time - Math.round(G.time)) < 1 / 120) audio.sfx('tick');
  const bossActive = L.boss.st !== 'wait' && L.boss.st !== 'dead';
  audio.tempo(bossActive ? 1.32 : superOn ? 1.18 : (G.time <= 10 ? 1.25 : 1));

  // input → movement
  const maxV = superOn ? 3.1 : 2.2;
  const acc = 0.32;
  if (keys.ArrowLeft) { P.vx = Math.max(-maxV, P.vx - acc); P.facing = -1; }
  else if (keys.ArrowRight) { P.vx = Math.min(maxV, P.vx + acc); P.facing = 1; }
  else P.vx *= P.grounded ? 0.72 : 0.9;
  if (Math.abs(P.vx) < 0.05) P.vx = 0;

  // jump (space or up)
  const jumpKey = keys[' '] || keys.ArrowUp;
  const jumpPressed = pressed[' '] || pressed.ArrowUp;
  if (jumpPressed) {
    if (P.grounded || P.coyote > 0) {
      P.vy = JUMPV; P.grounded = false; P.coyote = 0;
      P.jumpCount = 1;
      audio.sfx('jump');
    } else if (P.jumpCount < (superOn ? 3 : 2)) {
      P.vy = JUMPV * 0.92;
      P.jumpCount++;
      audio.sfx('jump');
      spawnBurst(P.x + P.w / 2, P.y + P.h, superOn ? '#ffe45a' : '#7de8ff', 6, 1.5);
    }
  }
  if (!jumpKey && P.vy < -2.5) P.vy = -2.5; // variable jump height
  P.vy = Math.min(8, P.vy + GRAV);
  if (P.coyote > 0) P.coyote--;

  // horizontal move + wall blocking against raised ground
  P.x += P.vx;
  if (P.x < 0) P.x = 0;
  if (P.x + P.w > L.widthPx) P.x = L.widthPx - P.w;
  const feetY = P.y + P.h;
  for (const dir of [1, -1]) {
    const edgeX = dir === 1 ? P.x + P.w : P.x;
    const col = Math.floor(edgeX / TILE);
    const gt = groundTopAt(col);
    if (gt != null && feetY > gt + 3 && P.y < 17 * TILE) {
      if (dir === 1 && P.vx >= 0) P.x = col * TILE - P.w - 0.01;
      if (dir === -1 && P.vx <= 0) P.x = (col + 1) * TILE + 0.01;
    }
  }

  // vertical move + landing
  const wasGrounded = P.grounded;
  const prevBottom = P.y + P.h;
  P.y += P.vy;
  P.grounded = false;
  if (P.vy >= 0) {
    const bottom = P.y + P.h;
    // ground columns
    const c1 = Math.floor((P.x + 2) / TILE), c2 = Math.floor((P.x + P.w - 2) / TILE);
    for (let col = c1; col <= c2; col++) {
      const gt = groundTopAt(col);
      if (gt != null && bottom >= gt && prevBottom <= gt + 4) {
        P.y = gt - P.h; P.vy = 0; P.grounded = true;
      }
    }
    // one-way platforms
    if (!P.grounded) for (const pl of L.plats) {
      if (P.x + P.w - 2 > pl.x && P.x + 2 < pl.x + pl.w &&
          bottom >= pl.y && prevBottom <= pl.y + 4) {
        P.y = pl.y - P.h; P.vy = 0; P.grounded = true;
      }
    }
  }
  if (P.grounded) {
    P.coyote = 7;
    P.jumpCount = 0;
    if (!wasGrounded && P.vy === 0) audio.sfx('land');
    // record safe respawn spot (solid ground, neighbors solid too)
    const col = Math.floor((P.x + P.w / 2) / TILE);
    if (groundTopAt(col) != null && groundTopAt(col - 1) != null && groundTopAt(col + 1) != null
        && Math.abs(P.y + P.h - groundTopAt(col)) < 2) {
      P.safeX = P.x; P.safeY = P.y;
    }
  }
  if (P.y > VH + 50) { pitFall(); return; }

  // camera
  const target = P.x + P.w / 2 - VW * 0.42;
  cam += (target - cam) * 0.12;
  cam = Math.max(0, Math.min(L.widthPx - VW, cam));
  if (G.shake > 0) G.shake--;

  // books
  const pcx = P.x + P.w / 2, pcy = P.y + P.h / 2;
  for (const b of L.books) {
    if (b.got || b.eaten) continue;
    const by = b.y + Math.sin(G.frame * 0.05 + b.phase) * 4;
    const hitX = b.gold ? 20 : 15;
    const hitY = b.gold ? 28 : 22;
    if (Math.abs(b.x - pcx) < hitX && Math.abs(by - pcy) < hitY) {
      b.got = true;
      G.runSet.add(b.i);
      G.order.push(b.i);
      const bk = BOOKS[b.i];
      if (b.gold) {
        G.superT = 600;
        G.powerBannerT = 150;
        G.powerFlashA = 0.95;
        G.powerLightningT = 28;
        G.powerStrikeX = b.x;
        G.powerBookTitle = bk.t;
        G.shake = Math.max(G.shake, 18);
        audio.sfx('lengle');
        audio.sfx('thunder');
        spawnBurst(b.x, by, '#ffd23e', 36, 4);
        addPopup(trunc(bk.t, 34), b.x, by - 14, '#fff6d0');
      } else {
        audio.sfx('collect');
        spawnBurst(b.x, by, BOOK_COLORS[b.colIdx], 6, 1.5);
        addPopup(trunc(bk.t, 30), b.x, by - 14, '#ffffff');
      }
    }
  }

  // Coffee with cream and sugar restores one heart, but never exceeds three.
  for (const coffee of L.coffees) {
    if (coffee.got || G.hearts >= MAX_HEARTS) continue;
    const cy = coffee.y + Math.sin(G.frame * 0.06 + coffee.phase) * 2;
    if (Math.abs(coffee.x - pcx) < 18 && Math.abs(cy + 7 - pcy) < 24) {
      coffee.got = true;
      G.hearts = Math.min(MAX_HEARTS, G.hearts + 1);
      audio.sfx('coffee');
      spawnBurst(coffee.x, cy + 6, '#f8f1dd', 16, 2.2);
      addPopup('CREAM + SUGAR: +1 COFFEE!', coffee.x, cy - 12, '#fff4b5');
    }
  }

  // enemies
  for (const e of L.enemies) {
    if (!e.alive) continue;
    e.t++;
    if (e.type === 'blot') {
      e.x = e.ax + Math.sin(e.t * 0.02 * e.speed) * 70;
      e.y = e.ay + Math.sin(e.t * 0.055) * 22;
    } else if (e.type === 'moth') {
      // Book moths flutter in a figure-eight instead of circling like phones.
      e.x = e.ax + Math.sin(e.t * 0.035 * e.speed) * 54;
      e.y = e.ay + Math.sin(e.t * 0.07 * e.speed) * 24;
    } else if (e.type === 'jelly') {
      // jellyfish drift sideways and pulse upward with each squeeze
      e.x = e.ax + Math.sin(e.t * 0.014 * e.speed) * 58;
      e.y = e.ay + Math.sin(e.t * 0.045) * 26 - Math.max(0, Math.sin(e.t * 0.09)) * 6;
    } else if (e.type === 'horse' || e.type === 'elephant') {
      // gallop along the ground, wheeling around at the edge of their turf
      e.x += e.dir * (e.type === 'horse' ? 1.5 : 1.1) * e.speed;
      if (e.x > e.ax + 95) e.dir = -1;
      else if (e.x < e.ax - 95) e.dir = 1;
      const ecol = Math.max(0, Math.min(L.cols - 1, Math.floor(e.x / TILE)));
      const egt = groundTopAt(ecol);
      if (egt == null) { e.dir *= -1; e.x += e.dir * 4; } // don't gallop into pits
      else e.y = egt - 11; // drawn at 2x — feet on the ground
    } else if (e.type === 'skunk') {
      // skunks trot around the yards; near Dr. Raven they stop, turn, and spray
      if (e.sprayT > 0) {
        e.sprayT--;
        if (e.sprayT === 12) {
          const sd = Math.sign(pcx - e.x) || e.dir;
          stinks.push({ x: e.x + sd * 10, y: e.y - 4, vx: sd * 1.1, t: 0, life: 260 });
          audio.sfx('throw');
        }
      } else {
        e.x += e.dir * 0.7 * e.speed;
        if (e.x > e.ax + 85) e.dir = -1;
        else if (e.x < e.ax - 85) e.dir = 1;
        if (e.cool > 0) e.cool--;
        else if (Math.abs(pcx - e.x) < 190 && Math.abs(pcy - e.y) < 40) {
          e.sprayT = 26; e.cool = 150;
          e.dir = Math.sign(pcx - e.x) || e.dir;
        }
      }
      const ecol = Math.max(0, Math.min(L.cols - 1, Math.floor(e.x / TILE)));
      const egt = groundTopAt(ecol);
      if (egt == null) { e.dir *= -1; e.x += e.dir * 4; }
      else e.y = egt - 5;
    } else if (e.type === 'student') {
      // med students hurry over to ask a question; once answered (or handed a
      // book) they stop chasing. Reading students stand perfectly still.
      if (e.st !== 'reading') {
        if (e.st !== 'asked' && Math.abs(pcx - e.x) < 160 && Math.abs(pcy - e.y) < 60) {
          e.x += Math.sign(pcx - e.x) * 0.85 * e.speed;
          e.dir = Math.sign(pcx - e.x) || e.dir;
        } else {
          e.x = e.ax + Math.sin(e.t * 0.012) * 26;
          e.dir = Math.cos(e.t * 0.012) >= 0 ? 1 : -1;
        }
        const ecol = Math.max(0, Math.min(L.cols - 1, Math.floor(e.x / TILE)));
        const egt = groundTopAt(ecol);
        e.y = (egt == null ? 256 : egt) - 8;
      }
    } else { // envelope: hover, then swoop at player
      if (e.st === 'hover') {
        e.x = e.ax + Math.sin(e.t * 0.03) * 20;
        e.y = e.ay + Math.sin(e.t * 0.06) * 10;
        if (e.cool > 0) e.cool--;
        else if (Math.abs(pcx - e.x) < 150 && pcy > e.y - 30) {
          e.st = 'dive';
          const dx = pcx - e.x, dy = pcy - e.y, d = Math.hypot(dx, dy) || 1;
          e.sx = dx / d * 2.4 * e.speed; e.sy = dy / d * 2.4 * e.speed;
          e.diveT = 50;
        }
      } else if (e.st === 'dive') {
        e.x += e.sx; e.y += e.sy;
        if (--e.diveT <= 0 || e.y > 272) e.st = 'back';
      } else { // back
        e.x += (e.ax - e.x) * 0.05; e.y += (e.ay - e.y) * 0.05;
        if (Math.abs(e.x - e.ax) < 6 && Math.abs(e.y - e.ay) < 6) { e.st = 'hover'; e.cool = 120; }
      }
    }
    // students who got their answer (or a book to read) are harmless
    if (e.type === 'student' && (e.st === 'asked' || e.st === 'reading')) continue;
    // collision with player
    const ew = e.type === 'moth' ? 18 : e.type === 'horse' || e.type === 'elephant' ? 34 : e.type === 'jelly' ? 14 : e.type === 'student' ? 12 : e.type === 'skunk' ? 16 : 16;
    const eh = e.type === 'moth' ? 12 : e.type === 'horse' || e.type === 'elephant' ? 20 : e.type === 'jelly' ? 12 : e.type === 'student' ? 16 : e.type === 'skunk' ? 10 : 13;
    if (pcx > e.x - ew / 2 - 6 && pcx < e.x + ew / 2 + 6 &&
        pcy > e.y - eh / 2 - 12 && pcy < e.y + eh / 2 + 12) {
      if (superOn) {
        e.alive = false;
        audio.sfx('pop');
        spawnBurst(e.x, e.y, '#ffffff', 12, 2.5);
        if (e.type === 'skunk') addGrave(e.x, e.y);
        else addPopup(defeatQuip(e) || 'POOF!', e.x, e.y - 14, '#ffe45a');
      } else if (e.type === 'student') {
        // no heart lost — but the question costs 10 minutes off the clock
        e.st = 'asked';
        G.time = Math.max(0.5, G.time - 10);
        audio.sfx('locked');
        addPopup(STUDENT_QUESTIONS[Math.floor(Math.random() * STUDENT_QUESTIONS.length)], e.x, e.y - 26, '#7de8ff');
        addPopup('-10 MINUTES!', P.x + P.w / 2, P.y - 14, '#ff5a5a');
      } else hurt(e.x);
    }
  }

  // stinky skunk clouds drift low along the yards — jump them or book them
  for (const c of stinks) {
    c.t++; c.life--;
    c.x += c.vx;
    c.y += Math.sin(c.t * 0.15) * 0.2;
    if (c.life <= 0 || c.x < cam - 40 || c.x > cam + VW + 40) { c.dead = true; continue; }
    if (Math.abs(pcx - c.x) < 13 && Math.abs(pcy - c.y) < 12) {
      c.dead = true;
      if (superOn || P.iframes > 0) { spawnBurst(c.x, c.y, '#7dc93e', 8, 2); audio.sfx('pop'); }
      else hurt(c.x);
    }
  }
  stinks = stinks.filter(c => !c.dead);

  // throw collected books (ENTER anywhere but the door; CMD also works)
  const nearDoor = Math.abs((P.x + P.w / 2) - (L.doorX + 11)) < 26 && P.y + P.h > 220;
  if (throwCool > 0) throwCool--;
  const throwPressed = pressed.Meta || (pressed.Enter && !nearDoor);
  if (throwPressed && ammoLeft() > 0 && throwCool <= 0) {
    shotsUsed++;
    throwCool = 12;
    const ids = [...G.runSet];
    const pick = ids[Math.floor(Math.random() * ids.length)];
    projs.push({
      x: P.x + P.w / 2 + P.facing * 10, y: P.y + 10,
      vx: P.facing * 5, vy: -0.6,
      cv: coverOf(pick), colIdx: pick % BOOK_COLORS.length, rot: 0,
    });
    audio.sfx('throw');
  }

  // projectiles
  for (const pr of projs) {
    pr.x += pr.vx; pr.y += pr.vy; pr.vy += 0.05; pr.rot += 0.35;
    if (pr.x < cam - 30 || pr.x > cam + VW + 30 || pr.y > 300) { pr.dead = true; continue; }
    for (const e of L.enemies) {
      if (!e.alive) continue;
      if (Math.abs(e.x - pr.x) < 14 && Math.abs(e.y - pr.y) < 14) {
        if (e.type === 'student') {
          // a med student hit with a book just... starts reading it
          if (e.st === 'reading') continue; // already lost in a book
          e.st = 'reading';
          e.readCv = pr.cv; e.readCol = pr.colIdx;
          pr.dead = true;
          audio.sfx('collect');
          addPopup('OOH, A BOOK!', e.x, e.y - 22, '#7de8ff');
          break;
        }
        e.alive = false; pr.dead = true;
        audio.sfx('pop');
        spawnBurst(e.x, e.y, '#ffffff', 12, 2.5);
        if (e.type === 'skunk') addGrave(e.x, e.y);
        else addPopup(defeatQuip(e) || "I'VE BEEN BY HERE TONIGHT!", e.x, e.y - 14, '#ffe45a');
        break;
      }
    }
    // books burst stink clouds mid-air
    if (!pr.dead) for (const c of stinks) {
      if (!c.dead && Math.abs(c.x - pr.x) < 13 && Math.abs(c.y - pr.y) < 13) {
        c.dead = true; pr.dead = true;
        spawnBurst(c.x, c.y, '#7dc93e', 10, 2);
        audio.sfx('pop');
        break;
      }
    }
    const bz = L.boss;
    if (!pr.dead && bz.st !== 'wait' && bz.st !== 'dead' && bz.inv <= 0 &&
        Math.abs(bz.x - pr.x) < 15 * bz.scale && Math.abs(bz.y - pr.y) < 18 * bz.scale) {
      pr.dead = true;
      bossHit();
    }
  }
  projs = projs.filter(pr => !pr.dead);

  // Jack the Dog — boss at the end of the level
  const bz = L.boss;
  const bs = bz.scale;
  if (bz.inv > 0) bz.inv--;
  if (bz.st === 'wait' && P.x > L.doorX - 320) {
    bz.st = 'intro';
    audio.sfx('bark');
    const cry = L.idx === 6 ? 'JACK HAS THE KIDS!'
      : bz.giant ? 'GIANT JACK WANTS TO EAT THE BOOKS!'
      : 'JACK THE DOG APPEARS!';
    addPopup(cry, L.doorX - 160, 90, '#ff5a5a');
    G.shake = bz.giant ? 14 : 8;
  } else if (bz.st === 'intro') {
    bz.y += (bz.ay - bz.y) * 0.06;
    bz.x = bz.ax;
    if (Math.abs(bz.y - bz.ay) < 4) { bz.st = 'hover'; bz.cool = 60; }
  } else if (bz.st === 'hover') {
    bz.t++;
    bz.ax += Math.max(-bz.drift, Math.min(bz.drift, (pcx - bz.ax) * 0.02));
    bz.ax = Math.max(L.doorX - 330, Math.min(L.doorX + 20, bz.ax));
    bz.x = bz.ax + Math.sin(bz.t * 0.05) * 14;
    bz.y = bz.ay + Math.sin(bz.t * 0.08) * 10;
    if (--bz.cool <= 0) {
      bz.st = 'dash';
      const dx = pcx - bz.x, dy = pcy - bz.y, d = Math.hypot(dx, dy) || 1;
      bz.sx = dx / d * bz.dashSpeed; bz.sy = dy / d * bz.dashSpeed;
      bz.diveT = 55;
      audio.sfx('bark');
    }
  } else if (bz.st === 'dash') {
    bz.x += bz.sx; bz.y += bz.sy;
    if (--bz.diveT <= 0 || bz.y > 250 || bz.y < 30) bz.st = 'back';
  } else if (bz.st === 'back') {
    bz.x += (bz.ax - bz.x) * 0.06; bz.y += (bz.ay - bz.y) * 0.06;
    if (Math.abs(bz.x - bz.ax) < 8 && Math.abs(bz.y - bz.ay) < 8) { bz.st = 'hover'; bz.cool = bz.dashCool; }
  } else if (bz.st === 'dead') {
    bz.spin += 0.3; bz.y += 2.6; bz.x += 1.2;
  }
  // giant Jack vacuums up nearby books
  if (bz.giant && (bz.st === 'hover' || bz.st === 'back' || bz.st === 'dash')) {
    if (++bz.eatT > 130) {
      bz.eatT = 0;
      let best = null, bd = 300;
      for (const b of L.books) {
        if (b.got || b.eaten) continue;
        const d = Math.hypot(b.x - bz.x, b.y - bz.y);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) {
        best.eaten = true;
        bz.belly.push(best);
        audio.sfx('pop');
        spawnBurst(best.x, best.y, '#ffffff', 8, 2);
        addPopup('CHOMP!', bz.x, bz.y - 34, '#ff5a5a');
      }
    }
  }
  // boss vs player: stomp bounces + damages him, side contact hurts her
  if (bz.st === 'hover' || bz.st === 'dash' || bz.st === 'back') {
    const overX = Math.abs(pcx - bz.x) < 16 * bs;
    const pBottom = P.y + P.h;
    if (overX && P.vy > 1 && pBottom > bz.y - 16 * bs && pBottom < bz.y - 2 * bs) {
      P.vy = -6.8;
      bossHit();
    } else if (overX && Math.abs(pcy - bz.y) < 20 * bs) {
      if (superOn) bossHit();
      else hurt(bz.x);
    }
  }
  // Donnie appears after the wedding-level battle
  if (L.donnie) {
    const dn = L.donnie;
    dn.t++;
    if (dn.st === 'wait' && bz.st === 'dead') {
      dn.st = 'in';
      dn.t = 0;
      spawnBurst(dn.x, 230, '#ff9ec0', 20, 2.5);
      addPopup('DONNIE APPEARS!', dn.x, 196, '#ff9ec0');
      addPopup("THE WORLD'S GREATEST HUSBAND!", dn.x, 208, '#ffe45a');
      audio.sfx('lengle');
    } else if (dn.st === 'in' && dn.t > 25) dn.st = 'idle';
    if (dn.st === 'idle' && !dn.met && Math.abs(pcx - dn.x) < 46) {
      dn.met = true;
      dn.sayT = 320;
      audio.sfx('collect');
      spawnBurst(pcx, P.y - 8, '#ff4560', 14, 2);
    }
    if (dn.sayT > 0) dn.sayT--;
  }

  // freeing the caged family (kids on L7, Dr. Raven's parents on L1,
  // CC & Uncle B with Butter & Bacon on L3)
  if (L.cage && !L.cage.open && bz.st === 'dead') {
    L.cage.open = true;
    audio.sfx('clear');
    if (L.cage.parents) {
      addPopup('THANK YOU, DR. RAVEN.', L.cage.x + 23, L.cage.y - 26, '#5aff8f');
      addPopup('YOU ARE OUR FAVORITE.', L.cage.x + 23, L.cage.y - 14, '#ffe45a');
    } else if (L.cage.auburn) {
      addPopup('THANK YOU, SISTER-WOMAN!', L.cage.x + 28, L.cage.y - 26, '#5aff8f');
      addPopup('ARF! ARF!', L.cage.x + 28, L.cage.y - 14, '#ffe45a');
    } else {
      addPopup('MOM!!!', L.cage.x + 23, L.cage.y - 14, '#5aff8f');
      addPopup('THE KIDS ARE FREE!', L.cage.x + 23, L.cage.y - 26, '#ffe45a');
    }
    spawnBurst(L.cage.x + 23, L.cage.y + 10, '#ffe45a', 18, 2.5);
  }

  // door (locked until Jack is defeated)
  const doorOpen = bz.st === 'dead' || bz.st === 'gone';
  if (nearDoor && pressed.Enter) {
    if (doorOpen) {
      audio.sfx('door');
      completeLevel();
      return;
    } else {
      audio.sfx('locked');
      addPopup('LOCKED! DEFEAT JACK THE DOG!', L.doorX + 11, L.doorY - 26, '#ff5a5a');
      G.shake = 4;
    }
  }

  // particles & popups
  updateFx();

  // super sparkle trail
  if (superOn && G.frame % 3 === 0) {
    particles.push({
      x: P.x + P.w / 2 + (Math.random() - .5) * 14,
      y: P.y + Math.random() * P.h,
      vx: (Math.random() - .5) * .5, vy: -.6, life: 22,
      color: ['#ff5abf', '#5adfff', '#ffe45a'][G.frame % 3], g: 0,
    });
  }

  // inventory
  if (pressed.Tab) { G.state = 'inv'; G.invScroll = 0; audio.sfx('menu'); }
}

function updateFx() {
  for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += p.g; p.life--; }
  particles = particles.filter(p => p.life > 0);
  for (const p of popups) { p.y -= 0.35; p.life--; }
  popups = popups.filter(p => p.life > 0);
  for (const b of lostBookFx) {
    b.x += b.vx; b.y += b.vy; b.vy += 0.18; b.rot += b.vr; b.life--;
  }
  lostBookFx = lostBookFx.filter(b => b.life > 0 && b.y < VH + 60);
}
function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + '.' : s; }

// ---------------------------------------------------------- draw: world
function drawWorld() {
  const pal = L.pal;
  // sky
  const grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, pal.sky1); grad.addColorStop(1, pal.sky2);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, VH);

  const shakeX = G.shake > 0 ? (Math.random() - .5) * G.shake * 0.8 : 0;
  const shakeY = G.shake > 0 ? (Math.random() - .5) * G.shake * 0.5 : 0;

  // parallax far scenery
  const fw = L.bg.far.width;
  let off = Math.floor((-cam * 0.35) % fw);
  for (let x = off - fw; x < VW + fw; x += fw) ctx.drawImage(L.bg.far, Math.floor(x), 0);
  if (L.bg.mid) {
    off = Math.floor((-cam * 0.65) % 256);
    for (let x = off - 256; x < VW + 256; x += 256) ctx.drawImage(L.bg.mid, Math.floor(x), 0);
  }

  ctx.save();
  ctx.translate(Math.floor(-cam + shakeX), Math.floor(shakeY));

  // themed ground tiles
  const th = THEMES[L.idx];
  const c1 = Math.max(0, Math.floor(cam / TILE) - 1);
  const c2 = Math.min(L.cols - 1, Math.ceil((cam + VW) / TILE) + 1);
  const visiblePits = [];
  let pitCol = c1;
  while (pitCol <= c2) {
    if (L.ground[pitCol] != null) { pitCol++; continue; }
    let start = pitCol;
    while (pitCol <= c2 && L.ground[pitCol] == null) pitCol++;
    let end = pitCol - 1;
    while (start > 0 && L.ground[start - 1] == null) start--;
    while (end < L.cols - 1 && L.ground[end + 1] == null) end++;
    pitCol = end + 1;
    let left = start - 1, right = end + 1;
    while (left >= 0 && L.ground[left] == null) left--;
    while (right < L.cols && L.ground[right] == null) right++;
    const leftRow = left >= 0 ? L.ground[left] : 16;
    const rightRow = right < L.cols ? L.ground[right] : 16;
    const top = Math.min(leftRow == null ? 16 : leftRow, rightRow == null ? 16 : rightRow) * TILE;
    const x = start * TILE, width = (end - start + 1) * TILE;
    const pitGrad = ctx.createLinearGradient(0, top, 0, VH);
    pitGrad.addColorStop(0, '#130b20');
    pitGrad.addColorStop(0.28, '#07040c');
    pitGrad.addColorStop(1, '#010103');
    ctx.fillStyle = pitGrad;
    ctx.fillRect(x, top, width, VH - top);
    ctx.fillStyle = '#2b1740';
    ctx.fillRect(x, top, width, 3);
    ctx.fillStyle = 'rgba(90,55,125,.24)';
    for (let sx = x + 5; sx < x + width; sx += 10) ctx.fillRect(sx, top + 7, 2, VH - top - 7);
    visiblePits.push({ start, end, left, right, leftRow, rightRow });
  }
  for (let col = c1; col <= c2; col++) {
    const r = L.ground[col];
    if (r == null) continue;
    for (let row = r; row < 18; row++) {
      const x = col * TILE, y = row * TILE;
      ctx.fillStyle = th.g; ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = th.gD;
      // per-theme body texture
      if (th.id === 'medical' || th.id === 'kennel') { // clean grid tiles
        ctx.fillRect(x, y + 15, TILE, 1); ctx.fillRect(x + 15, y, 1, TILE);
      } else if (th.id === 'football') { // turf mow stripes
        if (col % 2) { ctx.fillStyle = th.gT; ctx.fillRect(x, y, TILE, TILE); ctx.fillStyle = th.gD; }
        if (col % 8 === 0) { ctx.fillStyle = th.gX; ctx.fillRect(x + 7, y, 2, TILE); ctx.fillStyle = th.gD; } // yard line
      } else { // speckled earth/sand/rock
        ctx.fillRect(x + ((col * 7 + row * 5) % 12), y + ((col * 5 + row * 11) % 12) + 2, 2, 2);
        ctx.fillRect(x + ((col * 11 + row * 3) % 12) + 2, y + ((col * 3 + row * 7) % 10) + 4, 2, 1);
      }
      if (row === r) { // top edge
        ctx.fillStyle = th.gT; ctx.fillRect(x, y, TILE, 3);
        if (th.id === 'country' || th.id === 'horse' || th.id === 'kenwick') { // grass blades
          ctx.fillRect(x + 2, y - 2, 2, 2); ctx.fillRect(x + 9, y - 2, 2, 2);
        } else if (th.id === 'wedding') { // rose petal trim
          ctx.fillStyle = th.gX; ctx.fillRect(x + 4, y, 2, 2); ctx.fillRect(x + 12, y + 1, 2, 2);
        }
      }
    }
  }

  // Bright ledge markers make every pit readable against dark terrain.
  for (const pit of visiblePits) {
    if (pit.left >= 0 && pit.leftRow != null) {
      const x = pit.start * TILE - 4, y = pit.leftRow * TILE;
      ctx.fillStyle = '#ffe45a'; ctx.fillRect(x, y, 4, 14); ctx.fillRect(x - 5, y, 9, 3);
      ctx.fillStyle = '#3a2410'; ctx.fillRect(x, y + 5, 4, 3);
    }
    if (pit.right < L.cols && pit.rightRow != null) {
      const x = (pit.end + 1) * TILE, y = pit.rightRow * TILE;
      ctx.fillStyle = '#ffe45a'; ctx.fillRect(x, y, 4, 14); ctx.fillRect(x, y, 9, 3);
      ctx.fillStyle = '#3a2410'; ctx.fillRect(x, y + 5, 4, 3);
    }
  }

  // themed scenery props (behind everything else in the world)
  for (const p of L.props) {
    if (p.x < cam - 60 || p.x > cam + VW + 60) continue;
    drawProp(p);
  }

  // bookshelf platforms
  for (const pl of L.plats) {
    if (pl.x > cam + VW || pl.x + pl.w < cam) continue;
    ctx.fillStyle = '#6e4a26'; ctx.fillRect(pl.x, pl.y, pl.w, 5);
    ctx.fillStyle = '#8a6234'; ctx.fillRect(pl.x, pl.y, pl.w, 2);
    // tiny book spines hanging under the shelf
    for (let bx = pl.x + 2; bx < pl.x + pl.w - 3; bx += 4) {
      ctx.fillStyle = BOOK_COLORS[(bx / 4 | 0) % BOOK_COLORS.length];
      ctx.fillRect(bx, pl.y + 5, 3, 7 + ((bx / 4 | 0) % 3));
    }
    ctx.fillStyle = '#4f3419'; ctx.fillRect(pl.x, pl.y + 4, pl.w, 1);
  }

  // Kenwick ends at the family grocery — sign and storefront sit behind the door
  if (L.idx === 6 && L.cage) drawWilsons();

  // door (glows gold once Dr. Jack is beaten, red padlock while he guards it)
  const doorOpen = L.boss.st === 'dead';
  if (doorOpen) {
    const doorGlow = Math.sin(G.frame * 0.08) * 0.25 + 0.45;
    ctx.save();
    ctx.globalAlpha = doorGlow * 0.5;
    ctx.fillStyle = '#ffe45a';
    ctx.fillRect(L.doorX - 6, L.doorY - 6, 34, 46);
    ctx.restore();
  }
  ctx.drawImage(SPR.door, L.doorX, L.doorY);
  if (!doorOpen) { // padlock
    ctx.fillStyle = '#d9a516';
    ctx.fillRect(L.doorX + 7, L.doorY + 16, 8, 6);
    ctx.fillStyle = '#8a6a10';
    ctx.fillRect(L.doorX + 8, L.doorY + 13, 1, 3); ctx.fillRect(L.doorX + 13, L.doorY + 13, 1, 3);
    ctx.fillRect(L.doorX + 9, L.doorY + 12, 4, 1);
    ctx.fillStyle = '#3a2410'; ctx.fillRect(L.doorX + 10, L.doorY + 18, 2, 2);
  }
  const nearDoor = Math.abs((P.x + P.w / 2) - (L.doorX + 11)) < 26;
  if (nearDoor) {
    const bob = Math.sin(G.frame * 0.12) * 2;
    drawTextC(doorOpen ? 'PRESS ENTER' : 'LOCKED', L.doorX + 11, L.doorY - 16 + bob, 1, doorOpen ? '#ffe45a' : '#ff5a5a', '#000');
  }

  // Coffee cups bob above the ground; full-health cups remain for later.
  for (const coffee of L.coffees) {
    if (coffee.got || coffee.x < cam - 24 || coffee.x > cam + VW + 24) continue;
    const cy = coffee.y + Math.sin(G.frame * 0.06 + coffee.phase) * 2;
    if (G.hearts < MAX_HEARTS) {
      ctx.save();
      ctx.globalAlpha = Math.sin(G.frame * 0.12 + coffee.phase) * 0.12 + 0.2;
      ctx.fillStyle = '#fff4b5';
      ctx.beginPath(); ctx.arc(coffee.x, cy + 7, 14, 0, 6.29); ctx.fill();
      ctx.restore();
    }
    ctx.drawImage(SPR.coffee, Math.floor(coffee.x - SPR.coffee.width / 2), Math.floor(cy));
  }

  // books
  for (const b of L.books) {
    if (b.got || b.eaten) continue;
    if (b.x < cam - 20 || b.x > cam + VW + 20) continue;
    const by = b.y + Math.sin(G.frame * 0.05 + b.phase) * 4;
    if (b.gold) {
      const glow = Math.sin(G.frame * 0.15 + b.phase) * 0.2 + 0.5;
      ctx.save(); ctx.globalAlpha = glow;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(b.x, by + 7, 19, 0, 6.29); ctx.fill();
      ctx.restore();
      if (G.frame % 7 === 0) particles.push({
        x: b.x + (Math.random() - .5) * 24, y: by + (Math.random() - .5) * 24,
        vx: 0, vy: -.4, life: 18, color: '#fff6d0', g: 0,
      });
    }
    const cv = coverOf(b.i);
    if (b.gold) {
      // L'Engle power books are physically larger than ordinary covers.
      ctx.save();
      ctx.translate(Math.floor(b.x), Math.floor(by + 7));
      ctx.scale(1.6, 1.6);
      ctx.fillStyle = (G.frame >> 3) % 2 ? '#ffd23e' : '#fff6d0';
      ctx.fillRect(-7, -9, 14, 18);
      if (cv) ctx.drawImage(cv, -6, -8);
      else ctx.drawImage(bookSprite(b.colIdx, true), -6, -7);
      ctx.restore();
    } else if (cv) {
      ctx.drawImage(cv, Math.floor(b.x - 6), Math.floor(by - 1));
    } else {
      ctx.drawImage(bookSprite(b.colIdx, b.gold), Math.floor(b.x - 6), Math.floor(by));
    }
  }

  // thrown books
  for (const pr of projs) {
    ctx.save();
    ctx.translate(Math.floor(pr.x), Math.floor(pr.y));
    ctx.rotate(pr.rot);
    if (pr.cv) ctx.drawImage(pr.cv, -6, -8);
    else ctx.drawImage(bookSprite(pr.colIdx, false), -6, -7);
    ctx.restore();
  }

  // the caged family (kids on L8, G-Daddy & Pep on L1, CC & Uncle B + dogs on L3)
  if (L.cage) {
    const cg = L.cage;
    ctx.fillStyle = 'rgba(10,6,18,.55)';
    ctx.fillRect(cg.x, cg.y, cg.w, cg.h);
    // the captives (hop happily once freed)
    const roster = cg.parents ? SPR.parents
      : cg.auburn ? [SPR.cc, SPR.uncleb, SPR.butter, SPR.bacon]
      : SPR.kids;
    const step = cg.parents ? 20 : cg.auburn ? 13 : 14;
    for (let i = 0; i < roster.length; i++) {
      const k = roster[i];
      const hop = cg.open ? Math.abs(Math.sin(G.frame * 0.12 + i * 1.3)) * 5 : 0;
      // the Auburn four hop out to the LEFT — the right side is the exit door
      const kx = !cg.open ? cg.x + 3 + i * step
        : cg.auburn ? cg.x - 24 - i * 18
        : cg.x + cg.w + 6 + i * step;
      ctx.drawImage(k, Math.floor(kx), Math.floor(cg.y + cg.h - k.height - hop));
    }
    if (!cg.open) { // iron bars + lock
      ctx.fillStyle = '#3c3c4c';
      ctx.fillRect(cg.x - 2, cg.y - 3, cg.w + 4, 3);
      ctx.fillRect(cg.x - 2, cg.y + cg.h, cg.w + 4, 2);
      for (let bx = cg.x; bx <= cg.x + cg.w; bx += 6) ctx.fillRect(bx, cg.y - 2, 2, cg.h + 3);
      ctx.fillStyle = '#d9a516';
      ctx.fillRect(cg.x + cg.w / 2 - 3, cg.y + cg.h / 2 - 2, 6, 5);
      if ((G.frame >> 4) % 2 === 0) drawTextC('HELP!', cg.x + cg.w / 2, cg.y - 14, 1, '#ffe45a', '#000');
    } else if ((G.frame >> 4) % 3 !== 2) {
      if (cg.parents) {
        drawTextC('THANK YOU, DR. RAVEN.', cg.x + cg.w + 26, cg.y - 20, 1, '#5aff8f', '#000');
        drawTextC('YOU ARE OUR FAVORITE.', cg.x + cg.w + 26, cg.y - 10, 1, '#ffe45a', '#000');
      } else if (cg.auburn) {
        drawTextC('THANK YOU, SISTER-WOMAN!', cg.x - 50, cg.y - 20, 1, '#5aff8f', '#000');
        drawTextC('ARF! ARF!', cg.x - 50, cg.y - 10, 1, '#ffe45a', '#000');
      } else {
        drawTextC('THANKS MOM!', cg.x + cg.w + 26, cg.y - 10, 1, '#5aff8f', '#000');
      }
    }
  }

  // Donnie, the world's greatest husband (wedding level)
  if (L.donnie && L.donnie.st !== 'wait') {
    const dn = L.donnie;
    const col = Math.max(0, Math.min(L.cols - 1, Math.floor(dn.x / TILE)));
    const gt = groundTopAt(col) || 256;
    const bob = dn.st === 'idle' ? Math.sin(G.frame * 0.06) : 0;
    ctx.drawImage(SPR.donnie, Math.floor(dn.x - 12), Math.floor(gt - 32 + bob));
    if (dn.st === 'in') spawnBurst(dn.x, gt - 16, '#ff9ec0', 1, 1.5);
    else if (G.frame % 24 === 0) particles.push({
      x: dn.x + (Math.random() - .5) * 18, y: gt - 36,
      vx: (Math.random() - .5) * .3, vy: -.5, life: 30, color: '#ff4560', g: 0,
    });
  }

  // Jack the Dog (giant on the final level)
  const bz = L.boss;
  if (bz.st !== 'wait' && bz.y > -60) {
    const hurtFlash = bz.inv > 0 && (bz.inv >> 2) % 2 === 0;
    ctx.save();
    ctx.translate(Math.floor(bz.x), Math.floor(bz.y));
    if (bz.st === 'dead') ctx.rotate(bz.spin);
    else if (pcxOf() < bz.x) { ctx.scale(-1, 1); }
    ctx.scale(bz.scale, bz.scale);
    ctx.drawImage(hurtFlash ? SPR.jackHurt : SPR.jack, -12, -15);
    ctx.restore();
    if (bz.st !== 'dead') { // HP pips
      for (let i = 0; i < bz.maxHp; i++) drawHeart(bz.x - bz.maxHp * 6 + i * 12, bz.y - 28 * bz.scale, i < bz.hp);
    }
  }

  // enemies
  for (const e of L.enemies) {
    if (!e.alive) continue;
    if (e.x < cam - 30 || e.x > cam + VW + 30) continue;
    const spr = e.type === 'blot' ? SPR.blot : e.type === 'env' ? SPR.env
      : e.type === 'jelly' ? SPR.jelly : e.type === 'horse' ? SPR.horse
      : e.type === 'elephant' ? SPR.elephant : e.type === 'student' ? SPR.student
      : e.type === 'skunk' ? SPR.skunk
      : SPR.moth;
    const grounded = e.type === 'horse' || e.type === 'elephant' || e.type === 'student' || e.type === 'skunk';
    // ground runners bounce with their stride instead of hovering
    const still = (e.type === 'student' && e.st === 'reading') || (e.type === 'skunk' && e.sprayT > 0);
    const wob = grounded
      ? (still ? 0 : -Math.abs(Math.sin(e.t * 0.18)) * 2)
      : Math.sin(e.t * 0.1) * 1.5;
    if (e.type === 'moth') { // alternating wing shimmer
      ctx.save();
      ctx.globalAlpha = Math.sin(e.t * 0.24) * 0.18 + 0.28;
      ctx.fillStyle = '#d8f8ff';
      ctx.fillRect(Math.floor(e.x - 12), Math.floor(e.y - 4 + wob), 3, 2);
      ctx.fillRect(Math.floor(e.x + 9), Math.floor(e.y - 4 + wob), 3, 2);
      ctx.restore();
    }
    ctx.save();
    if (e.type === 'jelly') ctx.globalAlpha = 0.72 + Math.sin(e.t * 0.09) * 0.18;
    ctx.translate(Math.floor(e.x), Math.floor(e.y + wob));
    // horses and elephants are big animals — draw at 2x
    const sc = e.type === 'horse' || e.type === 'elephant' ? 2 : 1;
    ctx.scale(grounded && e.dir > 0 ? -sc : sc, sc); // art faces left; flip to run right
    ctx.drawImage(spr, -spr.width >> 1, -spr.height >> 1);
    ctx.restore();
    if (e.type === 'student') {
      if (e.st === 'reading') {
        // nose-deep in the thrown book, blocking nothing but the view
        const bk = e.readCv || bookSprite(e.readCol || 0, false);
        ctx.drawImage(bk, Math.floor(e.x + (e.dir > 0 ? 2 : -14)), Math.floor(e.y - 2));
      } else if (e.st !== 'asked' && (G.frame >> 4) % 2 === 0) {
        drawText('?', Math.floor(e.x - 2), Math.floor(e.y - 20 + wob), 2, '#7de8ff', '#000');
      }
    }
  }

  // skunk stink clouds — low, green, and jumpable
  for (const c of stinks) {
    ctx.save();
    ctx.globalAlpha = 0.55 + Math.sin(c.t * 0.2) * 0.15;
    ctx.fillStyle = '#6cc94a';
    ctx.beginPath();
    ctx.arc(c.x - 5, c.y + 2, 5, 0, 6.29);
    ctx.arc(c.x + 3, c.y, 6, 0, 6.29);
    ctx.arc(c.x + 8, c.y + 3, 4, 0, 6.29);
    ctx.fill();
    ctx.fillStyle = '#8adf5e';
    ctx.beginPath(); ctx.arc(c.x, c.y - 2, 4, 0, 6.29); ctx.fill();
    ctx.restore();
  }

  // player
  drawPlayer();

  // Lost books tumble away as a visual effect; they cannot be collected again.
  for (const b of lostBookFx) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.life / 18);
    ctx.translate(Math.floor(b.x), Math.floor(b.y));
    ctx.rotate(b.rot);
    if (b.cv) ctx.drawImage(b.cv, -6, -8);
    else ctx.drawImage(bookSprite(b.colIdx, b.gold), -6, -7);
    ctx.restore();
  }

  // Dr. Raven's speech bubble to Donnie
  if (L.donnie && L.donnie.sayT > 0) {
    const lines = ['I LOVE YOU DONNIE.', "YOU'RE THE BEST."];
    const bw = 84, bh = 24;
    const bx = Math.floor(P.x + P.w / 2 - bw / 2);
    const by = Math.floor(P.y - 38);
    ctx.fillStyle = '#1c1c24'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(bx + bw / 2 - 2, by + bh, 5, 1); // tail
    ctx.fillStyle = '#ffffff'; ctx.fillRect(bx + bw / 2 - 1, by + bh, 3, 3);
    drawTextC(lines[0], bx + bw / 2, by + 4, 1, '#1c1c24');
    drawTextC(lines[1], bx + bw / 2, by + 13, 1, '#c33b2f');
  }

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 15);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 2, 2);
  }
  ctx.globalAlpha = 1;

  // popups (book titles)
  for (const p of popups) {
    ctx.globalAlpha = Math.min(1, p.life / 25);
    if (p.grave) { // a humble marker: RIP SKUNK
      ctx.fillStyle = '#8a8a92';
      ctx.fillRect(p.x - 11, p.y - 8, 22, 20);
      ctx.fillRect(p.x - 8, p.y - 12, 16, 5);
      ctx.fillStyle = '#6e6e78'; ctx.fillRect(p.x - 11, p.y + 10, 22, 2);
      drawTextC('RIP', p.x, p.y - 6, 1, '#2a2a30');
      drawTextC('SKUNK', p.x, p.y + 2, 1, '#2a2a30');
    } else {
      drawTextC(p.text, p.x, p.y, 1, p.color, '#000');
    }
  }
  ctx.globalAlpha = 1;

  ctx.restore();
}

function drawPlayer() {
  if (P.iframes > 0 && (P.iframes >> 2) % 2 === 0) return; // blink
  let spr;
  let frameIdx;
  if (!P.grounded) { spr = SPR.jump; frameIdx = 3; }
  else if (Math.abs(P.vx) > 0.3) {
    P.animT += Math.abs(P.vx) * 0.055;
    const f = Math.floor(P.animT) % 2;
    spr = f ? SPR.run1 : SPR.run2; frameIdx = f ? 1 : 2;
  } else { spr = SPR.stand; frameIdx = 0; P.animT = 0; }

  if (G.superT > 0) {
    // glow aura
    const a = Math.sin(G.frame * 0.2) * 0.15 + 0.35;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = '#ffe45a';
    ctx.beginPath();
    ctx.ellipse(P.x + P.w / 2, P.y + P.h / 2, 18, 22, 0, 0, 6.29);
    ctx.fill(); ctx.restore();
    if ((G.frame >> 2) % 2 === 0) spr = SPR.superFrames[(G.frame >> 3) % 3][frameIdx];
  }
  const dx = Math.floor(P.x - 5), dy = Math.floor(P.y - 2);
  if (P.facing === 1) ctx.drawImage(spr, dx, dy);
  else {
    ctx.save();
    ctx.translate(dx + 24, dy); ctx.scale(-1, 1);
    ctx.drawImage(spr, 0, 0);
    ctx.restore();
  }
  // super timer warning flicker handled by blink above
}

// ---------------------------------------------------------- draw: HUD
function drawHUD() {
  ctx.fillStyle = 'rgba(6,4,12,.72)';
  ctx.fillRect(0, 0, VW, 22);
  ctx.fillStyle = '#2a1f45'; ctx.fillRect(0, 22, VW, 1);

  // books count
  ctx.drawImage(bookSprite(1, false), 6, 4);
  drawText(pad(totalCollected(), 4) + '/' + TOTAL_BOOKS, 22, 8, 1, '#fff');
  // lengle stars
  drawText('*' + lengleCount() + '/' + TOTAL_LENGLE, 92, 8, 1, '#ffd23e');
  // health: five cups of coffee (Jack's boss pips stay hearts)
  for (let i = 0; i < MAX_HEARTS; i++) drawCup(144 + i * 12, 6, i < G.hearts);
  if (G.ramona) drawText('R', 206, 8, 1, '#ffd23e'); // ramona cheat active this level
  // level name
  drawTextC('L' + (G.level + 1) + ' ' + LVL_META[G.level].name, VW / 2 + 10, 8, 1, '#c9b8ec');
  // throwable book ammo
  drawText('BOOKS ' + pad(ammoLeft(), 3), VW - 134, 8, 1, '#7de8ff');
  // timer
  const secondsLeft = Math.ceil(G.time);
  const warning = secondsLeft <= 10;
  const flash = warning && (G.frame >> 3) % 2 === 0;
  drawText('TIME ' + formatLevelClock(G.time), VW - 82, 8, 1, flash ? '#ff5a5a' : '#fff');
  // boss banner
  const bz = L.boss;
  if (bz.st !== 'wait' && bz.st !== 'dead') {
    const banner = L.idx === 6 ? 'SAVE SCARLETT, HANK & RAMONA!'
      : bz.giant ? 'GIANT JACK IS EATING THE BOOKS!'
      : 'JACK THE DOG BLOCKS THE EXIT!';
    if ((G.frame >> 4) % 2 === 0) drawTextC(banner, VW / 2, 44, 1, '#ff5a5a', '#000');
    drawTextC('STOMP HIS HEAD OR PRESS ENTER TO THROW BOOKS', VW / 2, 54, 1, '#c9b8ec', '#000');
  }
  if (warning) {
    drawTextC('BEDTIME IN ' + secondsLeft + '!', VW / 2, 66, 2, flash ? '#ff5a5a' : '#ffe45a', '#000');
  }

  // super meter
  if (G.superT > 0) {
    const w = Math.floor((G.superT / 600) * 80);
    ctx.fillStyle = '#000'; ctx.fillRect(VW / 2 - 42, 26, 84, 6);
    ctx.fillStyle = ['#ff5abf', '#5adfff', '#ffe45a'][(G.frame >> 3) % 3];
    ctx.fillRect(VW / 2 - 40, 27, w, 4);
    drawTextC('SUPER READER - TRIPLE JUMP', VW / 2, 35, 1, '#ffe45a', '#000');
  }
}
function drawPowerDrama() {
  if (G.powerFlashA > 0.02) {
    ctx.fillStyle = 'rgba(225,235,255,' + G.powerFlashA.toFixed(2) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }

  if (G.powerLightningT > 0) {
    const strikeX = Math.max(24, Math.min(VW - 24, G.powerStrikeX - cam));
    const targetY = Math.max(70, Math.min(VH - 30, P.y + P.h / 2));
    const points = [{ x: strikeX, y: -4 }];
    for (let i = 1; i < 9; i++) {
      const y = targetY * (i / 9);
      const jag = Math.sin(i * 9.7 + G.frame * 1.9) * 13 + (i % 2 ? 7 : -7);
      points.push({ x: strikeX + jag, y });
    }
    points.push({ x: strikeX, y: targetY });
    ctx.save();
    ctx.globalAlpha = Math.min(1, G.powerLightningT / 8);
    ctx.lineJoin = 'bevel';
    for (const [width, color] of [[7, '#5adfff'], [3, '#ffffff']]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (G.powerBannerT > 0) {
    const age = 150 - G.powerBannerT;
    const alpha = Math.min(1, age / 10, G.powerBannerT / 24);
    const pulse = 1 + Math.sin(G.frame * 0.22) * 0.035;
    const titleLines = wrapPixelText(G.powerBookTitle, 36).slice(0, 2);
    const titleY = titleLines.length > 1 ? 30 : 38;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(8,4,18,.72)';
    ctx.fillRect(32, 60, VW - 64, 116);
    ctx.translate(VW / 2, 72);
    ctx.scale(pulse, pulse);
    drawTextC("L'ENGLE BOOK FOUND!", 0, 0, 4, '#ffe45a', '#3a2410');
    for (let i = 0; i < titleLines.length; i++) {
      drawTextC(titleLines[i], 0, titleY + i * 19, 3, '#ffffff', '#6e2a54');
    }
    drawTextC('SUPER READER - TRIPLE JUMP!', 0, titleY + titleLines.length * 19 + 6, 2, '#7de8ff', '#000');
    ctx.restore();
  }
}
// HUD health pip: a little coffee mug, steaming while full
function drawCup(x, y, full) {
  ctx.fillStyle = full ? '#f4f4f8' : '#3a2438';
  ctx.fillRect(x, y + 2, 8, 7);                       // mug
  ctx.fillRect(x + 8, y + 3, 2, 5);                   // handle
  ctx.fillStyle = full ? '#6e4423' : '#241a28';
  ctx.fillRect(x + 1, y + 3, 6, 2);                   // the brew
  if (full) {
    ctx.fillStyle = 'rgba(255,244,181,.85)';          // steam
    const s = (G.frame >> 3) % 2;
    ctx.fillRect(x + 2 + s, y - 1, 1, 2);
    ctx.fillRect(x + 5 - s, y - 2, 1, 2);
  }
}
function drawHeart(x, y, full) {
  ctx.fillStyle = full ? '#ff4560' : '#3a2438';
  ctx.fillRect(x + 1, y, 3, 2); ctx.fillRect(x + 6, y, 3, 2);
  ctx.fillRect(x, y + 1, 10, 3);
  ctx.fillRect(x + 1, y + 4, 8, 2);
  ctx.fillRect(x + 2, y + 6, 6, 1);
  ctx.fillRect(x + 3, y + 7, 4, 1);
  ctx.fillRect(x + 4, y + 8, 2, 1);
  if (full) { ctx.fillStyle = '#ffb0c0'; ctx.fillRect(x + 2, y + 1, 2, 2); }
}
function pad(n, w) { return String(n).padStart(w, '0'); }

// ---------------------------------------------------------- backstory
// the story plays in pages; ENTER finishes the typing, then turns the page
const STORY_PAGES = [
  [
    'ONE STORMY NIGHT AT',
    'THE PIERCEY LIBRARY...',
    '',
    'DR. RAVEN WAS READING.',
    'JACK THE DOG - MAD SCIENTIST,',
    'SHEEPADOODLE, VERY BAD DOG -',
    'WAS IN HIS LAB.',
    '',
    'THAT IS NEVER GOOD.',
  ],
  [
    'JACK FIRED UP HIS',
    'TIME MACHINE...',
    '',
    'AND BLASTED DR. RAVEN',
    '44 YEARS INTO THE PAST!',
  ],
  [
    'HER 1,026 BELOVED BOOKS ARE',
    'SCATTERED ACROSS THE MOST',
    'IMPORTANT PLACES OF HER LIFE -',
    '',
    'THE BEACH. THE COLLEGE.',
    'THE BALLGAME. THE WEDDING.',
    'ALL OF IT.',
  ],
  [
    'COLLECT EVERY BOOK',
    'IN EVERY PLACE...',
    '',
    'OR SHE WILL NEVER',
    'HAVE THEM AGAIN.',
  ],
  [
    'ONLY ONE PSYCHOLOGIST CAN',
    'READ HER WAY BACK',
    'TO THE PRESENT.',
    '',
    'SHE IS... DR. RAVEN.',
  ],
];
let storyPage = 0, storyChars = 0, lastThunder = 0, flashA = 0;
function storyPageDone() {
  return storyChars >= STORY_PAGES[storyPage].join('').length;
}
function updateStory() {
  G.frame++;
  storyChars += 0.9;
  if (!storyPageDone() && G.frame % 3 === 0) audio.sfx('type');
  // random thunder + lightning flash
  if (G.stateT - lastThunder > 150 && Math.random() < 0.012) {
    lastThunder = G.stateT;
    flashA = 0.75;
    audio.sfx('thunder');
    G.shake = 10;
  }
  flashA *= 0.92;
  if (G.shake > 0) G.shake--;
  if (pressed.Enter) {
    if (!storyPageDone()) {
      storyChars = STORY_PAGES[storyPage].join('').length; // finish typing
    } else if (storyPage < STORY_PAGES.length - 1) {
      storyPage++; storyChars = 0;                          // next part
      audio.sfx('menu');
      if (storyPage === 1) { audio.sfx('thunder'); flashA = 0.75; G.shake = 12; }
    } else {
      // the adventure starts at the level picker
      openLevelSelect();
    }
  }
}
function drawStory() {
  const grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, '#05030c'); grad.addColorStop(1, '#1a0f2e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, VH);
  const shx = G.shake > 0 ? (Math.random() - .5) * G.shake : 0;
  ctx.save();
  ctx.translate(shx, 0);
  // rain
  ctx.strokeStyle = 'rgba(130,150,220,.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const rx = (i * 61 + G.frame * 6) % (VW + 60) - 30;
    const ry = (i * 97 + G.frame * 11) % VH;
    ctx.moveTo(rx, ry); ctx.lineTo(rx - 3, ry + 9);
  }
  ctx.stroke();
  // time vortex once the machine fires (page 2 onward)
  const jx = VW - 130, jy = 60 + Math.sin(G.frame * 0.04) * 5;
  if (storyPage >= 1) {
    const vx = jx - 40, vy = jy + 70;
    for (let ring = 0; ring < 4; ring++) {
      const rr = 14 + ring * 9 + Math.sin(G.frame * 0.1 + ring) * 3;
      ctx.strokeStyle = ring % 2 ? 'rgba(125,232,255,.5)' : 'rgba(255,90,191,.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const a0 = G.frame * 0.07 * (ring % 2 ? 1 : -1) + ring;
      ctx.arc(vx, vy, rr, a0, a0 + 4.6);
      ctx.stroke();
    }
    drawTextC('44 YEARS', vx, vy - 3, 1, '#7de8ff', '#000');
  }
  // stolen books flying toward the vortex (behind Jack)
  for (let i = 0; i < 7; i++) {
    const t = (G.frame * (1.2 + i * 0.15) + i * 130) % 420;
    ctx.globalAlpha = 0.8;
    ctx.drawImage(bookSprite(i % BOOK_COLORS.length, false), Math.floor(t), Math.floor(200 - i * 22 - t * 0.18));
    ctx.globalAlpha = 1;
  }
  // Jack the Dog looming, scaled up, evil bob
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(jx, jy);
  ctx.scale(3.4, 3.4);
  ctx.drawImage(SPR.jack, 0, 0);
  ctx.restore();
  if ((G.frame >> 5) % 3 !== 2) drawTextC('WOOF HA HA HA!', jx + 40, jy - 14, 1, '#ff5a5a', '#000');
  // typewriter text for the current story page
  const page = STORY_PAGES[storyPage];
  let remaining = Math.floor(storyChars);
  let y = 36;
  for (let li = 0; li < page.length; li++) {
    const line = page[li];
    if (remaining <= 0) break;
    const show = line.slice(0, remaining);
    remaining -= line.length;
    const gold = storyPage === STORY_PAGES.length - 1 && li === page.length - 1;
    drawText(show, 18, y, 2, gold ? '#ffd23e' : '#e8e0f8', '#000');
    y += line === '' ? 9 : 17;
  }
  ctx.restore();
  // lightning flash
  if (flashA > 0.02) {
    ctx.fillStyle = 'rgba(220,225,255,' + flashA.toFixed(2) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
  // page prompt
  const last = storyPage === STORY_PAGES.length - 1;
  if (storyPageDone()) {
    if ((G.frame >> 4) % 2 === 0) {
      drawTextC(last ? 'PRESS ENTER TO BEGIN' : 'PRESS ENTER', VW / 2, 258, 2, '#fff', '#000');
    }
    drawTextC('- ' + (storyPage + 1) + ' / ' + STORY_PAGES.length + ' -', VW / 2, 276, 1, '#8a76b4');
  } else {
    drawTextC('ENTER: SKIP AHEAD   - ' + (storyPage + 1) + ' / ' + STORY_PAGES.length + ' -', VW / 2, 272, 1, '#6b5a8c');
  }
}

// ---------------------------------------------------------- overworld map (between levels)
// 8-bit RPG map of the southeast US. 32x18 tiles of 16px.
// w water, g grass, s sand, t tree, m mountain, d dark mountain (Jack's lair)
// The Southeast US, zoomed to the route: Gulf Coast at the bottom,
// Lake Erie & Ohio (Jack's Lair) at the top, Atlantic on the right,
// Florida bottom-right, Appalachians mid-right, Kentucky woods center.
const MAP_TILES = [
  'ggggggggggggggggggwwwggggggwwwww',
  'ggggggggggggggggggwwggddgggwwwww',
  'gggggggggggggggggggggddmggwwwwww',
  'ggggggggggggggggggggddmmggwwwwww',
  'ggggggggggggggggggggmmmgggwwwwww',
  'gggggggggggggtggggmmmmggggwwwwww',
  'ggggggggggggttggggtmmgggggwwwwww',
  'gggggggggggggtgggggmmggggwwwwwww',
  'ggggggggggggggttgggmgggggwwwwwww',
  'ggggggggggggggggggggggggwwwwwwww',
  'ggggggggggggggggggggggggwwwwwwww',
  'gggggggggggggggggggggggwwwwwwwww',
  'ggggggggggggggggggggggwwwwwwwwww',
  'ggggggwwssgggggggggggwwwwwwwwwww',
  'gggggwwwsgggggggggwwwwwwwwwwwwww',
  'wwwwwwwwwwwwggggggwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwggggwwwwwwwwwwwwwww',
  'wwwwwwwwwwwwwwggwwwwwwwwwwwwwwww',
];
const MAP_STOPS = [
  { x: 150, y: 196, label: 'LOXLEY',      ldx: 32,  ldy: 6 },
  { x: 238, y: 108, label: 'WILMORE',     ldx: -36, ldy: 0 },
  { x: 222, y: 164, label: 'AUBURN',      ldx: 30,  ldy: 6 },
  { x: 122, y: 212, label: 'POINT CLEAR', ldx: 4,   ldy: 12, heart: true },
  { x: 252, y: 88,  label: 'LEXINGTON',   ldx: -44, ldy: 0 },
  { x: 272, y: 100, label: 'UK MED',      ldx: 30,  ldy: 2 },
  // Kenwick is a Lexington neighborhood — its pin sits beside Lexington's
  { x: 262, y: 84,  label: 'KENWICK',     ldx: 34,  ldy: -6 },
  { x: 330, y: 38,  label: "JACK'S LAIR", ldx: 46,  ldy: 0, evil: true },
];
const MAP_START = { x: 30, y: 200 }; // she walks in along the gulf coast
const MAP_GEO = [
  ['ATLANTIC', 452, 28], ['GULF OF MEXICO', 130, 262],
  ['FLORIDA', 300, 250], ['OHIO', 388, 52],
];
let mapCanvas = null;
function tileRnd(tx, ty, k) { // deterministic per-tile hash for speckles
  let n = (tx * 73856093) ^ (ty * 19349663) ^ (k * 83492791);
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}
function ensureMapCanvas() {
  if (mapCanvas) return;
  mapCanvas = document.createElement('canvas');
  mapCanvas.width = VW; mapCanvas.height = VH;
  const g = mapCanvas.getContext('2d');
  for (let ty = 0; ty < 18; ty++) for (let tx = 0; tx < 32; tx++) {
    const t = MAP_TILES[ty][tx];
    const x = tx * 16, y = ty * 16;
    if (t === 'w') {
      g.fillStyle = '#4a86d9'; g.fillRect(x, y, 16, 16);
      g.fillStyle = '#4079cc'; // faint darker dashes for texture
      const dx1 = Math.floor(tileRnd(tx, ty, 11) * 10);
      g.fillRect(x + 2 + dx1, y + 11, 4, 1);
      g.fillStyle = '#a8c9f0'; // little wave dashes
      for (let k = 0; k < 2; k++) {
        const wx = Math.floor(tileRnd(tx, ty, k) * 11);
        const wy = Math.floor(tileRnd(tx, ty, k + 7) * 12);
        g.fillRect(x + 2 + wx, y + 2 + wy, 3, 1);
      }
    } else if (t === 's') {
      g.fillStyle = '#e8d494'; g.fillRect(x, y, 16, 16);
      g.fillStyle = '#d4bc72';
      g.fillRect(x + 3, y + 5, 2, 1); g.fillRect(x + 10, y + 10, 2, 1);
    } else { // land base
      g.fillStyle = '#6cc94a'; g.fillRect(x, y, 16, 16);
      g.fillStyle = '#7ed95a';
      for (let k = 0; k < 3; k++) {
        const sx = Math.floor(tileRnd(tx, ty, k) * 14);
        const sy = Math.floor(tileRnd(tx, ty, k + 3) * 14);
        g.fillRect(x + 1 + sx, y + 1 + sy, 2, 1);
      }
      if (t === 't') { // pine tree
        g.fillStyle = '#1d5c26';
        g.fillRect(x + 6, y + 3, 4, 2); g.fillRect(x + 4, y + 5, 8, 2);
        g.fillRect(x + 2, y + 7, 12, 3);
        g.fillStyle = '#2e7c33';
        g.fillRect(x + 5, y + 4, 3, 1); g.fillRect(x + 3, y + 7, 4, 1);
        g.fillStyle = '#54381f'; g.fillRect(x + 7, y + 10, 2, 3);
      } else if (t === 'm' || t === 'd') { // mountain
        const dark = t === 'd';
        g.fillStyle = dark ? '#3a2a3a' : '#8a8a96';
        g.fillRect(x + 6, y + 2, 4, 2); g.fillRect(x + 4, y + 4, 8, 3);
        g.fillRect(x + 2, y + 7, 12, 4); g.fillRect(x + 1, y + 11, 14, 2);
        g.fillStyle = dark ? '#241a24' : '#5c5c66';
        g.fillRect(x + 9, y + 4, 3, 3); g.fillRect(x + 11, y + 7, 3, 4);
        g.fillStyle = dark ? '#ff3030' : '#ffffff'; // snow cap / lava glow
        g.fillRect(x + 6, y + 2, 4, 1); g.fillRect(x + 7, y + 3, 2, 1);
      }
    }
  }
}
function mapSeg() {
  // walking into level G.level; before level 1 she walks in from off-route
  const a = G.level === 0 ? MAP_START : MAP_STOPS[G.level - 1];
  return { a, b: MAP_STOPS[G.level] };
}
function mapSegDur() {
  const { a, b } = mapSeg();
  return Math.max(110, Math.round(Math.hypot(b.x - a.x, b.y - a.y) * 1.6));
}
function updateMap() {
  G.frame++;
  G.mapT++;
  const dur = mapSegDur();
  if (!G.mapArrived && G.mapT >= dur) {
    G.mapArrived = true;
    audio.sfx('collect');
  }
  if (pressed.Enter) {
    if (!G.mapArrived) { G.mapT = dur; G.mapArrived = true; audio.sfx('menu'); }
    else startLevel(G.level, true);
  }
}
function drawMap() {
  ensureMapCanvas();
  ctx.drawImage(mapCanvas, 0, 0);
  // geography labels
  for (const [name, gx, gy] of MAP_GEO) drawTextC(name, gx, gy, 1, '#f0f4ff', '#1a3a70');
  // dotted route through all stops (like an old map quest line)
  ctx.fillStyle = '#2b4496';
  for (let i = 0; i < MAP_STOPS.length - 1; i++) {
    const a = MAP_STOPS[i], b = MAP_STOPS[i + 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    for (let s = 0; s < d; s += 7) {
      ctx.fillRect(Math.round(a.x + (b.x - a.x) * s / d) - 1, Math.round(a.y + (b.y - a.y) * s / d) - 1, 2, 2);
    }
  }
  // pins + labels
  for (let i = 0; i < MAP_STOPS.length; i++) {
    const st = MAP_STOPS[i];
    const visited = i < G.level, dest = i === G.level;
    if (st.heart) {
      ctx.fillStyle = visited || dest ? '#ff4560' : '#8a4556';
      ctx.fillRect(st.x - 3, st.y - 4, 3, 2); ctx.fillRect(st.x + 1, st.y - 4, 3, 2);
      ctx.fillRect(st.x - 4, st.y - 3, 9, 3); ctx.fillRect(st.x - 3, st.y, 7, 2);
      ctx.fillRect(st.x - 2, st.y + 2, 5, 1); ctx.fillRect(st.x - 1, st.y + 3, 3, 1);
    } else if (st.evil) {
      const pulse = dest && (G.frame >> 4) % 2 === 0;
      ctx.fillStyle = pulse ? '#ff3030' : '#241a24';
      ctx.fillRect(st.x - 4, st.y - 5, 9, 9);
      ctx.fillStyle = '#ff3030';
      ctx.fillRect(st.x - 2, st.y - 3, 2, 2); ctx.fillRect(st.x + 1, st.y - 3, 2, 2);
    } else {
      ctx.fillStyle = '#1a3a1a';
      ctx.beginPath(); ctx.arc(st.x, st.y, 5, 0, 6.29); ctx.fill();
      ctx.fillStyle = visited ? '#4ce860' : dest ? '#ffd23e' : '#96a89a';
      ctx.beginPath(); ctx.arc(st.x, st.y, 4, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.fillRect(st.x - 1, st.y - 1, 2, 2);
    }
    drawTextC(st.label, st.x + st.ldx, st.y + st.ldy, 1, dest ? '#ffe45a' : '#ffffff', '#1a3a1a');
  }
  // Dr. Raven walking the route
  const { a, b } = mapSeg();
  const dur = mapSegDur();
  const k = Math.min(1, G.mapT / dur);
  const px = a.x + (b.x - a.x) * k;
  const py = a.y + (b.y - a.y) * k - 14 + (G.mapArrived ? 0 : Math.abs(Math.sin(G.frame * 0.25)) * -2);
  const spr = G.mapArrived ? SPR.stand : ((G.frame >> 3) % 2 ? SPR.run1 : SPR.run2);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (b.x < a.x && !G.mapArrived) { // face left
    ctx.translate(Math.round(px + 7), Math.round(py - 9));
    ctx.scale(-0.6, 0.6);
  } else {
    ctx.translate(Math.round(px - 7), Math.round(py - 9));
    ctx.scale(0.6, 0.6);
  }
  ctx.drawImage(spr, 0, 0);
  ctx.restore();
  // banner
  ctx.fillStyle = 'rgba(6,4,12,.78)';
  ctx.fillRect(0, 0, VW, 22);
  const meta = LVL_META[G.level];
  drawTextC(G.mapArrived ? 'ARRIVED: ' + meta.name : 'TRAVELING TO: ' + meta.name, VW / 2, 5, 1, '#ffd23e');
  drawTextC(meta.sub, VW / 2, 14, 1, '#c9b8ec');
  ctx.fillStyle = 'rgba(6,4,12,.78)';
  ctx.fillRect(0, VH - 16, VW, 16);
  if (G.mapArrived && (G.frame >> 4) % 2 === 0) drawTextC('PRESS ENTER', VW / 2, VH - 11, 1, '#fff');
  else if (!G.mapArrived) drawTextC('ENTER: SKIP', VW / 2, VH - 11, 1, '#8a76b4');
}

// ---------------------------------------------------------- ending cutscene
// Overhead bedroom. Big RPG dialogue boxes advance on ENTER; then the camera
// pans to the foot of the bed...
const CUT_BOXES = [
  { who: null, lines: ['DR. RAVEN WAKES UP IN HER BED.', 'SHE IS SURROUNDED BY', 'ALL OF HER BOOKS.'] },
  { who: 'DR. RAVEN', lines: ['PHEW... IT WAS ALL A DREAM!'] },
  { who: 'JACK THE DOG', lines: ['SAME TIME TOMORROW,', 'DR. RAVEN?'], evil: true },
];
let cutPhase = 0, cutChars = 0, cutPanT = 0, cutBooks = null;
let cutFlashA = 0, cutLastThunder = 0;
function triggerCutLightning(intensity = 0.75) {
  cutFlashA = intensity;
  cutLastThunder = G.stateT;
  audio.sfx('thunder');
  G.shake = Math.max(G.shake, 10);
}
function startCutscene() {
  G.state = 'cutscene'; G.stateT = 0; G.shake = 0;
  cutPhase = 0; cutChars = 0; cutPanT = 0;
  cutFlashA = 0; cutLastThunder = 0;
  audio.play('story');
  audio.tempo(1);
  ensureCutBooks();
  for (const b of cutBooks) loadCover(b.i); // real covers for the bedroom floor
}
function cutBoxDone() {
  const box = CUT_BOXES[cutPhase === 3 ? 2 : cutPhase];
  return cutChars >= box.lines.join('').length;
}
function updateCutscene() {
  G.frame++;
  if (G.shake > 0) G.shake--;
  // Echo the opening storm: one early flash, then more while the player reads.
  if (G.stateT === 45 || (G.stateT - cutLastThunder > 150 && Math.random() < 0.012)) {
    triggerCutLightning();
  }
  cutFlashA *= 0.92;
  if (cutPhase === 0 || cutPhase === 1 || cutPhase === 3) {
    cutChars += 0.9;
    if (!cutBoxDone() && G.frame % 3 === 0) audio.sfx('type');
  }
  if (cutPhase === 2) { // the pan down to the foot of the bed
    cutPanT++;
    if (cutPanT === 55) {
      triggerCutLightning(0.92);
      audio.sfx('bark');
    }
    if (cutPanT >= 90) { cutPhase = 3; cutChars = 0; }
  }
  if (pressed.Enter) {
    if (cutPhase === 0 || cutPhase === 1) {
      if (!cutBoxDone()) cutChars = 9999;
      else {
        cutPhase++;
        cutChars = 0;
        audio.sfx('menu');
      }
    } else if (cutPhase === 2) {
      cutPanT = Math.max(cutPanT, 89);
    } else if (cutPhase === 3) {
      if (!cutBoxDone()) cutChars = 9999;
      else cutPhase = 4;
    } else { // 4: THE END?
      G.state = 'ending'; G.stateT = 0;
      audio.play('title');
    }
  }
}
function cutCam() {
  const lerp = (a, b, k) => a + (b - a) * Math.max(0, Math.min(1, k));
  if (cutPhase < 2) {
    return { zoom: lerp(1.6, 1.9, G.stateT / 700), fy: 115 };
  }
  return { zoom: 2.0, fy: lerp(115, 207, cutPanT / 90) };
}
function ensureCutBooks() {
  if (cutBooks) return;
  const rnd = RNG(0xBED);
  cutBooks = [];
  let bi = 0;
  const nextIdx = () => { bi = (bi + 137) % TOTAL_BOOKS; return bi; }; // spread through her library
  // dozens of loose books all over the floor, top of the room included
  for (let i = 0; i < 64; i++) {
    const x = 14 + rnd() * 476, y = 44 + rnd() * 224;
    if (x > 202 && x < 312 && y > 56 && y < 214) continue;  // not under the bed
    if (x > 304 && x < 344 && y > 62 && y < 110) continue;  // not under the nightstand
    cutBooks.push({ x, y, i: nextIdx(), c: Math.floor(rnd() * BOOK_COLORS.length), flat: rnd() < .5 });
  }
  // proper piles
  for (let p = 0; p < 8; p++) {
    const px = [60, 130, 360, 420, 170, 460, 92, 428][p];
    const py = [180, 240, 170, 230, 148, 190, 78, 66][p];
    const n = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      cutBooks.push({ x: px + (rnd() - .5) * 4, y: py - i * 4, i: nextIdx(), c: Math.floor(rnd() * BOOK_COLORS.length), flat: true, pile: true });
    }
  }
  // and a few right on top of the blanket
  for (let i = 0; i < 7; i++) {
    cutBooks.push({
      x: 220 + rnd() * 62, y: 108 + rnd() * 92,
      i: nextIdx(), c: Math.floor(rnd() * BOOK_COLORS.length),
      flat: rnd() < .7, onBed: true,
    });
  }
}
function drawCutBook(b) {
  const cv = coverOf(b.i);
  if (b.flat) {
    if (cv) ctx.drawImage(cv, Math.floor(b.x), Math.floor(b.y));
    else ctx.drawImage(bookSprite(b.c, false), Math.floor(b.x), Math.floor(b.y));
    if (b.pile) { ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(Math.floor(b.x), Math.floor(b.y) + (cv ? 16 : 14), 12, 2); }
  } else {
    ctx.save();
    ctx.translate(Math.floor(b.x) + 6, Math.floor(b.y) + 7);
    ctx.rotate(1.5708);
    if (cv) ctx.drawImage(cv, -6, -8);
    else ctx.drawImage(bookSprite(b.c, false), -6, -7);
    ctx.restore();
  }
}
function drawCutscene() {
  ensureCutBooks();
  const { zoom, fy } = cutCam();
  ctx.fillStyle = '#05030a'; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  const shx = G.shake > 0 ? (Math.random() - .5) * G.shake : 0;
  ctx.translate(VW / 2 + shx, VH / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-256, -fy);

  // -- the bedroom, seen from above --
  // wood floor
  for (let y = 0; y < 288; y += 12) {
    ctx.fillStyle = y % 24 ? '#6a4a2e' : '#755234';
    ctx.fillRect(0, y, 512, 12);
    ctx.fillStyle = '#54381f'; ctx.fillRect(0, y, 512, 1);
  }
  // rug
  ctx.fillStyle = '#8a3a4a';
  ctx.beginPath(); ctx.ellipse(256, 165, 120, 62, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#a5556a';
  ctx.beginPath(); ctx.ellipse(256, 165, 96, 48, 0, 0, 6.29); ctx.fill();
  // dozens of real books scattered across the floor, plus piles
  for (const b of cutBooks) if (!b.onBed) drawCutBook(b);
  // top wall + bookshelf (every book back on its shelf)
  ctx.fillStyle = '#3a2a4a'; ctx.fillRect(0, 0, 512, 38);
  ctx.fillStyle = '#54381f'; ctx.fillRect(120, 4, 320, 30);
  for (let row = 0; row < 2; row++) for (let bx = 126; bx < 434; bx += 5) {
    ctx.fillStyle = BOOK_COLORS[((bx / 5 | 0) + row * 3) % BOOK_COLORS.length];
    ctx.fillRect(bx, 7 + row * 14, 4, 11);
  }
  // window + moonlight
  ctx.fillStyle = '#101426'; ctx.fillRect(38, 4, 46, 30);
  ctx.fillStyle = '#cdd6ff'; ctx.beginPath(); ctx.arc(61, 16, 7, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(205,214,255,.08)'; ctx.fillRect(30, 38, 70, 130);
  // nightstand + lamp
  ctx.fillStyle = '#54381f'; ctx.fillRect(312, 70, 26, 28);
  ctx.fillStyle = 'rgba(255,217,138,.25)';
  ctx.beginPath(); ctx.arc(325, 78, 20, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#ffd98a'; ctx.fillRect(321, 74, 8, 8);
  ctx.drawImage(bookSprite(3, false), 314, 86);
  // bed
  ctx.fillStyle = '#3a2412'; ctx.fillRect(210, 62, 92, 10);           // headboard
  ctx.fillStyle = '#e8e4f0'; ctx.fillRect(214, 72, 84, 140);          // mattress
  ctx.fillStyle = '#ffffff'; ctx.fillRect(232, 78, 48, 18);           // pillow
  // Dr. Raven awake in bed: blonde hair fanned on the pillow, open green eyes
  ctx.fillStyle = PAL.h;                                              // hair shadow
  ctx.fillRect(243, 75, 26, 20);
  ctx.fillStyle = PAL.H;                                              // hair fan
  ctx.fillRect(244, 76, 24, 18);
  ctx.fillRect(238, 80, 6, 11); ctx.fillRect(268, 80, 6, 11);         // spread on pillow
  ctx.fillRect(240, 91, 5, 6); ctx.fillRect(267, 91, 5, 6);           // strands
  ctx.fillStyle = PAL.L;                                              // highlights
  ctx.fillRect(246, 77, 3, 9); ctx.fillRect(263, 78, 3, 8); ctx.fillRect(254, 76, 3, 4);
  ctx.fillStyle = PAL.S;                                              // face
  ctx.fillRect(249, 82, 14, 13); ctx.fillRect(250, 81, 12, 1); ctx.fillRect(251, 95, 10, 1);
  ctx.fillStyle = PAL.h;                                              // brows
  ctx.fillRect(251, 85, 3, 1); ctx.fillRect(258, 85, 3, 1);
  ctx.fillStyle = '#fff';                                             // eyes
  ctx.fillRect(251, 87, 3, 2); ctx.fillRect(258, 87, 3, 2);
  ctx.fillStyle = PAL.E;
  ctx.fillRect(252, 87, 2, 2); ctx.fillRect(259, 87, 2, 2);
  ctx.fillStyle = '#8a4536';                                          // relieved smile
  ctx.fillRect(254, 92, 4, 1); ctx.fillRect(253, 91, 1, 1); ctx.fillRect(258, 91, 1, 1);
  // blanket with stripes over her
  ctx.fillStyle = '#5a7ab5'; ctx.fillRect(214, 102, 84, 108);
  ctx.fillStyle = '#4a66a0';
  for (let by = 110; by < 205; by += 14) ctx.fillRect(214, by, 84, 5);
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fillRect(240, 102, 32, 108); // her shape under it
  // books that landed on the blanket
  for (const b of cutBooks) if (b.onBed) drawCutBook(b);
  // Jack the Dog, sitting silently at the end of the bed
  ctx.drawImage(SPR.jack, 244, 214);
  if (cutPhase >= 3) { // his eyes glow red
    const pulse = Math.sin(G.frame * 0.2) * 0.3 + 0.7;
    ctx.fillStyle = 'rgba(255,30,30,' + (0.35 * pulse).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(251, 223, 5, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(259, 223, 5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ff2020';
    ctx.fillRect(250, 222, 2, 2); ctx.fillRect(258, 222, 2, 2);
  }
  ctx.restore();

  // red dread vignette after the reveal
  if (cutPhase >= 3) {
    ctx.fillStyle = 'rgba(180,20,20,' + (0.10 + Math.sin(G.frame * 0.1) * 0.04).toFixed(2) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
  // Keep the dialogue readable by flashing the room before drawing the UI.
  if (cutFlashA > 0.02) {
    ctx.fillStyle = 'rgba(220,225,255,' + cutFlashA.toFixed(2) + ')';
    ctx.fillRect(0, 0, VW, VH);
  }
  // cinematic letterbox
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VW, 22); ctx.fillRect(0, VH - 22, VW, 22);

  // big RPG dialogue boxes
  if (cutPhase === 0 || cutPhase === 1 || cutPhase === 3) {
    const box = CUT_BOXES[cutPhase === 3 ? 2 : cutPhase];
    const bh = 26 + box.lines.length * 16;
    const by = VH - 30 - bh;
    ctx.fillStyle = 'rgba(8,12,32,.95)';
    ctx.fillRect(36, by, VW - 72, bh);
    ctx.fillStyle = box.evil ? '#ff3030' : '#ffffff';
    ctx.fillRect(36, by, VW - 72, 2); ctx.fillRect(36, by + bh - 2, VW - 72, 2);
    ctx.fillRect(36, by, 2, bh); ctx.fillRect(VW - 38, by, 2, bh);
    ctx.fillStyle = box.evil ? '#7d2015' : '#4a5a8c';
    ctx.fillRect(40, by + 4, VW - 80, 1); ctx.fillRect(40, by + bh - 5, VW - 80, 1);
    if (box.who) drawText(box.who + ':', 48, by - 8, 1, box.evil ? '#ff5a5a' : '#7de8ff', '#000');
    let remaining = Math.floor(cutChars);
    let ty = by + 10;
    for (const line of box.lines) {
      if (remaining <= 0) break;
      drawText(line.slice(0, remaining), 50, ty, 2, box.evil ? '#ffb0b0' : '#e8e0f8');
      remaining -= line.length;
      ty += 16;
    }
    if (cutBoxDone() && (G.frame >> 4) % 2 === 0) drawText('>', VW - 56, by + bh - 14, 2, '#ffe45a');
  }
  if (cutPhase === 4) {
    drawTextC('THE END?', VW / 2, 40, 3, '#ff3030', '#000');
    if ((G.frame >> 4) % 2 === 0) drawTextC('PRESS ENTER', VW / 2, VH - 14, 1, '#fff');
  }
}

// ---------------------------------------------------------- perfect ending
// Earned by collecting all 1,026 books AND rescuing everyone from Jack's
// cages. No storm, no dread: Dr. Raven wakes in a sunny beach house with her
// whole family, then everyone gathers on the beach for her 44th birthday.
const PERFECT_BOXES = [
  { who: null, lines: ['DR. RAVEN WAKES UP IN A SUNNY', 'BEACH HOUSE. EVERY BOOK IS', 'SAFE ON ITS SHELF.'] },
  { who: 'DR. RAVEN', lines: ['WHAT A DREAM... WAIT.', 'I SMELL COFFEE... AND THE SEA?'] },
  { who: 'DONNIE', lines: ['GOOD MORNING, BIRTHDAY GIRL!', 'FRESH COFFEE, JUST HOW', 'YOU LIKE IT.'] },
  { who: 'DONNIE', lines: ['DRINK UP! WE HAVE TO WALK DOWN', 'TO THE BOOKSTORE. WE OPEN IT', 'TODAY - FOR YOUR 44TH BIRTHDAY.'] },
  { who: 'SCARLETT', lines: ['MOM! GUESS WHAT? WE ALL MADE', 'HONOR ROLL ON OUR REPORT CARDS!'] },
  { who: 'HANK', lines: ['AND WE KEPT OUR ROOMS CLEAN.', 'REALLY CLEAN. YOU CAN CHECK!'] },
  { who: 'RAMONA', lines: ['WE EVEN SCRUBBED THE BATHROOMS!', 'THEY SPARKLE LIKE THE OCEAN.'] },
  { who: 'DR. RAVEN', lines: ['I LOVE MY FAMILY SO MUCH.', 'I AM SO THANKFUL FOR MY', 'AMAZING HUSBAND...'] },
  { who: 'DR. RAVEN', lines: ['...WHO CREATED THIS INCREDIBLE', 'GIFT FOR MY BIRTHDAY.', 'BEST. BIRTHDAY. EVER.'] },
];
const PERFECT_WHO_COLORS = {
  'DR. RAVEN': '#c9599e', 'DONNIE': '#2e8fd0',
  'SCARLETT': '#e8862e', 'HANK': '#3fae6a', 'RAMONA': '#8a5fc9',
};
let pfPhase = 0, pfChars = 0, pfDonnieT = 0, pfConfetti = null;
function startPerfect() {
  G.state = 'perfect'; G.stateT = 0; G.shake = 0;
  pfPhase = 0; pfChars = 0; pfDonnieT = 0; pfConfetti = null;
  audio.play('happy');
  audio.tempo(1);
}
function pfBoxDone() {
  return pfChars >= PERFECT_BOXES[pfPhase].lines.join('').length;
}
function updatePerfect() {
  G.frame++;
  pfChars += 0.9;
  if (!pfBoxDone() && G.frame % 3 === 0) audio.sfx('type');
  if (pfPhase >= 2 && pfDonnieT < 60) pfDonnieT++; // Donnie walks in with the coffee
  if (pressed.Enter) {
    if (!pfBoxDone()) pfChars = 9999;
    else if (pfPhase < PERFECT_BOXES.length - 1) {
      pfPhase++;
      pfChars = 0;
      audio.sfx('menu');
    } else {
      G.state = 'perfectEnd'; G.stateT = 0;
      audio.sfx('clear');
    }
  }
}
function drawPerfect() {
  ctx.fillStyle = '#bfe8ff'; ctx.fillRect(0, 0, VW, VH);
  ctx.save();
  ctx.translate(VW / 2, VH / 2);
  ctx.scale(1.25, 1.25);
  ctx.translate(-256, -118);

  // -- the beach-house bedroom, seen from above --
  // whitewashed plank floor with a sandy warmth
  for (let y = 0; y < 288; y += 12) {
    ctx.fillStyle = y % 24 ? '#e8d4a8' : '#f0e0ba';
    ctx.fillRect(0, y, 512, 12);
    ctx.fillStyle = '#cdb488'; ctx.fillRect(0, y, 512, 1);
  }
  // seafoam rug
  ctx.fillStyle = '#8fd8c8';
  ctx.beginPath(); ctx.ellipse(256, 165, 120, 62, 0, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#b8ecd8';
  ctx.beginPath(); ctx.ellipse(256, 165, 96, 48, 0, 0, 6.29); ctx.fill();
  // top wall: white shiplap
  ctx.fillStyle = '#f4efe4'; ctx.fillRect(0, 0, 512, 38);
  ctx.fillStyle = '#ddd5c2'; for (let wy = 9; wy < 38; wy += 10) ctx.fillRect(0, wy, 512, 1);
  // bookshelf — every single book home on its shelf
  ctx.fillStyle = '#b08d58'; ctx.fillRect(120, 4, 320, 30);
  for (let row = 0; row < 2; row++) for (let bx = 126; bx < 434; bx += 5) {
    ctx.fillStyle = BOOK_COLORS[((bx / 5 | 0) + row * 3) % BOOK_COLORS.length];
    ctx.fillRect(bx, 7 + row * 14, 4, 11);
  }
  // window: morning sun over the ocean
  ctx.fillStyle = '#7ec8f0'; ctx.fillRect(60, 4, 46, 30);
  ctx.fillStyle = '#2e8fd0'; ctx.fillRect(60, 22, 46, 12);          // sea
  ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(64, 25, 10, 1); ctx.fillRect(82, 29, 12, 1);
  ctx.fillStyle = '#ffe45a'; ctx.beginPath(); ctx.arc(83, 14, 7, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(81, 4, 2, 30); ctx.fillRect(60, 20, 46, 2); // frame
  ctx.fillStyle = 'rgba(255,230,150,.20)'; ctx.fillRect(52, 38, 70, 130);          // sunbeam
  // door in the top wall (Donnie comes through it)
  ctx.fillStyle = '#b08d58'; ctx.fillRect(392, 2, 30, 34);
  ctx.fillStyle = '#cdaa70'; ctx.fillRect(394, 4, 26, 30);
  ctx.fillStyle = '#6e5433'; ctx.fillRect(414, 18, 3, 3);
  // nightstand + a happy lamp
  ctx.fillStyle = '#b08d58'; ctx.fillRect(312, 70, 26, 28);
  ctx.fillStyle = 'rgba(255,217,138,.30)';
  ctx.beginPath(); ctx.arc(325, 78, 20, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#ffd98a'; ctx.fillRect(321, 74, 8, 8);
  ctx.drawImage(bookSprite(3, false), 314, 86);
  // bed
  ctx.fillStyle = '#e8dcc8'; ctx.fillRect(210, 62, 92, 10);           // whitewashed headboard
  ctx.fillStyle = '#ffffff'; ctx.fillRect(214, 72, 84, 140);          // mattress
  ctx.fillStyle = '#fff8ec'; ctx.fillRect(232, 78, 48, 18);           // pillow
  // Dr. Raven awake and smiling: same pose as the dark ending, sunnier morning
  ctx.fillStyle = PAL.h; ctx.fillRect(243, 75, 26, 20);
  ctx.fillStyle = PAL.H; ctx.fillRect(244, 76, 24, 18);
  ctx.fillRect(238, 80, 6, 11); ctx.fillRect(268, 80, 6, 11);
  ctx.fillRect(240, 91, 5, 6); ctx.fillRect(267, 91, 5, 6);
  ctx.fillStyle = PAL.L;
  ctx.fillRect(246, 77, 3, 9); ctx.fillRect(263, 78, 3, 8); ctx.fillRect(254, 76, 3, 4);
  ctx.fillStyle = PAL.S;
  ctx.fillRect(249, 82, 14, 13); ctx.fillRect(250, 81, 12, 1); ctx.fillRect(251, 95, 10, 1);
  ctx.fillStyle = PAL.h;
  ctx.fillRect(251, 85, 3, 1); ctx.fillRect(258, 85, 3, 1);
  ctx.fillStyle = '#fff';
  ctx.fillRect(251, 87, 3, 2); ctx.fillRect(258, 87, 3, 2);
  ctx.fillStyle = PAL.E;
  ctx.fillRect(252, 87, 2, 2); ctx.fillRect(259, 87, 2, 2);
  ctx.fillStyle = '#8a4536'; // big happy smile
  ctx.fillRect(253, 92, 6, 1); ctx.fillRect(252, 91, 1, 1); ctx.fillRect(259, 91, 1, 1);
  // coral blanket with sunny stripes
  ctx.fillStyle = '#ff9a8a'; ctx.fillRect(214, 102, 84, 108);
  ctx.fillStyle = '#f0806e';
  for (let by = 110; by < 205; by += 14) ctx.fillRect(214, by, 84, 5);
  ctx.fillStyle = 'rgba(255,255,255,.20)'; ctx.fillRect(240, 102, 32, 108);
  // the kids at their mom's bedside (kept above the dialogue box)
  ctx.drawImage(SPR.scarlett, 176, 100);
  ctx.drawImage(SPR.hank, 190, 122);
  ctx.drawImage(SPR.ramona, 176, 142);
  // Donnie walks in from the door carrying her coffee
  if (pfPhase >= 2) {
    const t = pfDonnieT / 60;
    const dx = Math.round(400 + (312 - 400) * t);
    const dy = Math.round(40 + (112 - 40) * t);
    ctx.drawImage(SPR.donnie, dx, dy);
    // the mug, held out in front
    ctx.fillStyle = '#fff'; ctx.fillRect(dx - 7, dy + 16, 6, 6);
    ctx.fillStyle = '#6e4423'; ctx.fillRect(dx - 6, dy + 17, 4, 2);
    ctx.fillStyle = '#fff'; ctx.fillRect(dx - 9, dy + 18, 2, 3);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; // steam
    ctx.fillRect(dx - 5 + Math.round(Math.sin(G.frame * 0.1) * 1.5), dy + 10, 1, 3);
    ctx.fillRect(dx - 3 + Math.round(Math.sin(G.frame * 0.1 + 2) * 1.5), dy + 8, 1, 3);
  }
  // Jack snoozing peacefully on the rug — a good boy in this timeline
  ctx.drawImage(SPR.jack, 332, 130);
  ctx.restore();

  // warm daylight vignette instead of dread
  ctx.fillStyle = 'rgba(255,230,150,.06)';
  ctx.fillRect(0, 0, VW, VH);
  // cinematic letterbox
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, VW, 22); ctx.fillRect(0, VH - 22, VW, 22);

  // sunny RPG dialogue boxes
  const box = PERFECT_BOXES[pfPhase];
  const bh = 26 + box.lines.length * 16;
  const by = VH - 30 - bh;
  ctx.fillStyle = 'rgba(255,252,240,.95)';
  ctx.fillRect(36, by, VW - 72, bh);
  ctx.fillStyle = '#ffd23e';
  ctx.fillRect(36, by, VW - 72, 2); ctx.fillRect(36, by + bh - 2, VW - 72, 2);
  ctx.fillRect(36, by, 2, bh); ctx.fillRect(VW - 38, by, 2, bh);
  ctx.fillStyle = '#e8b93e';
  ctx.fillRect(40, by + 4, VW - 80, 1); ctx.fillRect(40, by + bh - 5, VW - 80, 1);
  if (box.who) drawText(box.who + ':', 48, by - 8, 1, PERFECT_WHO_COLORS[box.who] || '#2e8fd0', '#fff');
  let remaining = Math.floor(pfChars);
  let ty = by + 10;
  for (const line of box.lines) {
    if (remaining <= 0) break;
    drawText(line.slice(0, remaining), 50, ty, 2, '#4a3820');
    remaining -= line.length;
    ty += 16;
  }
  if (pfBoxDone() && (G.frame >> 4) % 2 === 0) drawText('>', VW - 56, by + bh - 14, 2, '#e8862e');
}
function updatePerfectEnd() {
  G.frame++;
  if (G.stateT > 60 && pressed.Enter) {
    G.state = 'ending'; G.stateT = 0; // roll into the library stats screen
  }
}
function drawPerfectEnd() {
  const f = G.frame;
  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, 140);
  sky.addColorStop(0, '#6ec0f0'); sky.addColorStop(1, '#cfeeff');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, VW, 140);
  // sun with a soft glow
  ctx.fillStyle = 'rgba(255,228,90,.25)'; ctx.beginPath(); ctx.arc(432, 46, 36, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(255,228,90,.4)'; ctx.beginPath(); ctx.arc(432, 46, 27, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#ffe45a'; ctx.beginPath(); ctx.arc(432, 46, 20, 0, 6.29); ctx.fill();
  // drifting clouds
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  for (let i = 0; i < 3; i++) {
    const cxp = ((i * 190 + f * (0.12 + i * 0.05)) % (VW + 140)) - 70;
    const cyp = 26 + i * 24;
    ctx.beginPath();
    ctx.ellipse(cxp, cyp, 26, 9, 0, 0, 6.29);
    ctx.ellipse(cxp - 16, cyp + 4, 16, 7, 0, 0, 6.29);
    ctx.ellipse(cxp + 17, cyp + 4, 18, 7, 0, 0, 6.29);
    ctx.fill();
  }
  // the beach house they woke up in, up on the dune
  ctx.fillStyle = '#e8d4a8'; ctx.fillRect(0, 128, 130, 14);           // dune
  ctx.fillStyle = '#f4efe4'; ctx.fillRect(26, 96, 64, 34);            // walls
  ctx.fillStyle = '#d94436';                                          // roof
  ctx.beginPath(); ctx.moveTo(18, 98); ctx.lineTo(58, 78); ctx.lineTo(98, 98); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#b08d58'; ctx.fillRect(52, 108, 12, 22);           // door
  ctx.fillStyle = '#7ec8f0'; ctx.fillRect(32, 104, 12, 10); ctx.fillRect(72, 104, 12, 10); // windows
  ctx.fillStyle = '#fff'; ctx.fillRect(37, 104, 2, 10); ctx.fillRect(77, 104, 2, 10);
  // ocean
  const sea = ctx.createLinearGradient(0, 140, 0, 208);
  sea.addColorStop(0, '#2e8fd0'); sea.addColorStop(1, '#5ab8e8');
  ctx.fillStyle = sea; ctx.fillRect(0, 140, VW, 68);
  for (let r = 0; r < 5; r++) { // rolling white wave crests
    const wy = 150 + r * 12;
    const off = (f * (0.35 + r * 0.12) + r * 40) % 64;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.22 + r * 0.05).toFixed(2) + ')';
    for (let wx = -64 + off; wx < VW; wx += 64) ctx.fillRect(wx, wy, 24, 2);
  }
  // sand
  ctx.fillStyle = '#d8c088'; ctx.fillRect(0, 208, VW, 9);             // wet line
  ctx.fillStyle = '#f0dca8'; ctx.fillRect(0, 217, VW, VH - 217);
  ctx.fillStyle = '#dcc590';
  for (let i = 0; i < 60; i++) ctx.fillRect((i * 89) % VW, 222 + (i * 37) % 60, 2, 1);
  // palm tree
  ctx.fillStyle = '#8a6a3e';
  for (let s = 0; s < 9; s++) ctx.fillRect(58 + s, 216 - s * 8, 5, 9);
  ctx.fillStyle = '#3fae6a';
  for (let a = 0; a < 6; a++) {
    ctx.save();
    ctx.translate(70, 144);
    ctx.rotate(a * 1.05 - 2.6);
    ctx.beginPath(); ctx.ellipse(16, 0, 17, 5, 0, 0, 6.29); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#6e4423';
  ctx.beginPath(); ctx.arc(66, 148, 3, 0, 6.29); ctx.fill();
  ctx.beginPath(); ctx.arc(74, 150, 3, 0, 6.29); ctx.fill();
  // beach umbrella + towel
  ctx.fillStyle = '#b08d58'; ctx.fillRect(408, 168, 3, 52);
  for (let seg = 0; seg < 5; seg++) {
    ctx.fillStyle = seg % 2 ? '#fff' : '#d94436';
    ctx.beginPath();
    ctx.moveTo(409, 168);
    ctx.arc(409, 172, 34, Math.PI + seg * 0.63, Math.PI + (seg + 1) * 0.63);
    ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#7de8ff'; ctx.fillRect(430, 228, 40, 14);
  ctx.fillStyle = '#fff'; ctx.fillRect(430, 232, 40, 2); ctx.fillRect(430, 238, 40, 2);
  // -- everyone together --
  ctx.drawImage(SPR.gdaddy, 148, 231);
  ctx.drawImage(SPR.pep, 170, 232);
  ctx.drawImage(SPR.stand, 224, 218);
  ctx.drawImage(SPR.donnie, 256, 218);
  ctx.drawImage(SPR.scarlett, 300, 236);
  ctx.drawImage(SPR.hank, 316, 237);
  ctx.drawImage(SPR.ramona, 332, 237);
  ctx.drawImage(SPR.cc, 196, 233);
  ctx.drawImage(SPR.uncleb, 352, 232);
  // Butter & Bacon zooming along the wet sand
  ctx.drawImage(SPR.butter, Math.round(210 + Math.sin(f * 0.03) * 60), 209);
  ctx.save();
  ctx.translate(Math.round(260 - Math.sin(f * 0.03) * 60), 209);
  ctx.scale(-1, 1);
  ctx.drawImage(SPR.bacon, -16, 0);
  ctx.restore();
  // the raven, swooping happily over the water
  ctx.drawImage(SPR.raven, Math.round(96 + Math.sin(f * 0.02) * 44), Math.round(96 + Math.sin(f * 0.055) * 9));
  // Jack the (good) Dog, floating with his birthday balloons
  const jx = 342, jy = Math.round(84 + Math.sin(f * 0.04) * 7);
  ctx.strokeStyle = 'rgba(70,60,80,.8)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(jx + 4, jy - 18); ctx.lineTo(jx + 10, jy + 6);
  ctx.moveTo(jx + 12, jy - 26); ctx.lineTo(jx + 12, jy + 6);
  ctx.moveTo(jx + 20, jy - 18); ctx.lineTo(jx + 14, jy + 6);
  ctx.stroke();
  ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(jx + 4, jy - 24, 6, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#ffd23e'; ctx.beginPath(); ctx.arc(jx + 12, jy - 33, 7, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#7de8ff'; ctx.beginPath(); ctx.arc(jx + 20, jy - 24, 6, 0, 6.29); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(jx + 2, jy - 27, 2, 2); ctx.fillRect(jx + 10, jy - 36, 2, 2); ctx.fillRect(jx + 18, jy - 27, 2, 2);
  ctx.drawImage(SPR.jack, jx, jy);
  // confetti
  if (!pfConfetti) {
    pfConfetti = [];
    const rnd = RNG(0x44);
    for (let i = 0; i < 44; i++) pfConfetti.push({
      x: rnd() * VW, y: rnd() * VH, v: 0.4 + rnd() * 0.8,
      ph: rnd() * 6.28, c: BOOK_COLORS[i % BOOK_COLORS.length],
    });
  }
  for (const cf of pfConfetti) {
    cf.y += cf.v; if (cf.y > VH) { cf.y = -4; cf.x = (cf.x + 120) % VW; }
    ctx.fillStyle = cf.c;
    ctx.fillRect(Math.round(cf.x + Math.sin(f * 0.05 + cf.ph) * 6), Math.round(cf.y), 3, 3);
  }
  // the message
  drawTextC('THE END.', VW / 2, 24, 4, '#ffd23e', '#6e2a10');
  drawTextC('HAPPY 44TH BIRTHDAY, DR. RAVEN!', VW / 2, 58, 2, '#fff', '#c9599e');
  if (G.stateT > 60 && (G.frame >> 4) % 2 === 0) drawTextC('PRESS ENTER', VW / 2, 272, 1, '#4a3820');
}

// ---------------------------------------------------------- level select
function openLevelSelect(tour) {
  if (G.state === 'select') return;
  G.tourMode = !!tour;
  G.state = 'select';
  G.stateT = 0;
  G.selIdx = 0;
  audio.stop(); // landing-page theme ends once the player heads for a level
  audio.tempo(1);
  audio.sfx('menu');
}
function updateSelect() {
  G.frame++;
  const nOpts = LVL_META.length + (G.tourMode ? 2 : 0);
  if (pressed.ArrowDown) { G.selIdx = (G.selIdx + 1) % nOpts; audio.sfx('menu'); }
  if (pressed.ArrowUp) { G.selIdx = (G.selIdx + nOpts - 1) % nOpts; audio.sfx('menu'); }
  if (pressed.Enter && G.stateT > 8) {
    if (G.tourMode && G.selIdx === LVL_META.length) {
      audio.sfx('door');
      startCutscene();            // the dark "all a dream" ending
    } else if (G.tourMode && G.selIdx === LVL_META.length + 1) {
      audio.sfx('door');
      startPerfect();             // the beach-house birthday ending
    } else if (!G.tourMode && levelLocked(G.selIdx)) {
      audio.sfx('locked');
    } else {
      G.levelSelectRun = true;
      audio.sfx('door');
      startLevel(G.selIdx, true, G.tourMode); // tour mode bypasses locks
    }
  }
  if (pressed.Tab || pressed.Escape) {
    G.state = 'title'; G.menuSel = 0; G.stateT = 0; G.levelSelectRun = false;
    G.tourMode = false;
    audio.play('theme');
  }
}
function drawSelect() {
  ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, VW, VH);
  // scanline sparkle
  ctx.fillStyle = 'rgba(125,232,255,.04)';
  for (let y = (G.frame >> 1) % 6; y < VH; y += 6) ctx.fillRect(0, y, VW, 1);
  drawTextC('CHOOSE A LEVEL', VW / 2, 18, 3, '#ffd23e', '#3a2410');
  const finalOpen = finalBattleUnlocked();
  const hint = G.tourMode ? '* ENDING TOUR: EVERY LEVEL & BOTH ENDINGS OPEN *'
    : finalOpen ? "* JACK'S LAIR IS OPEN - FINISH THE STORY *"
    : kenwickUnlocked() ? '* KENWICK UNLOCKED - GO SAVE THE KIDS *'
    : 'BEAT THE FIRST 6 LEVELS TO UNLOCK KENWICK';
  drawTextC(hint, VW / 2, 44, 1, G.tourMode || finalOpen || kenwickUnlocked() ? '#ff5abf' : '#c9b8ec', '#000');
  const rowH = G.tourMode ? 18 : 20; // squeeze 10 rows in when the endings show
  for (let i = 0; i < LVL_META.length; i++) {
    const sel = i === G.selIdx;
    const y = 64 + i * rowH;
    const done = G.completedLevels.has(i);
    const locked = !G.tourMode && levelLocked(i);
    const label = i === LVL_META.length - 1 ? "L8 JACK'S LAIR - FINAL BATTLE" : 'L' + (i + 1) + ' ' + LVL_META[i].name;
    const color = locked ? '#453a5c' : sel ? '#fff' : i === LVL_META.length - 1 ? '#ff5a5a' : done ? '#5aff8f' : '#8a76b4';
    if (sel) drawText('>', VW / 2 - 140, y, 2, (G.frame >> 3) % 2 ? '#ffe45a' : '#ff5abf');
    drawText(label, VW / 2 - 124, y, 2, color);
    if (locked) {
      drawText('LOCKED', VW - 64, y + 3, 1, '#453a5c');
    } else if (done) {
      // books banked from this level, e.g. 90/112
      const total = LEVEL_BOOKS[i].length;
      const got = LEVEL_BOOKS[i].filter(b => G.collected.has(b)).length;
      drawText(got + '/' + total, VW - 64, y + 3, 1, got >= total ? '#ffd23e' : '#5aff8f', '#000');
    }
  }
  if (G.tourMode) { // the two endings, straight from the cheat menu
    const extras = ['THE DARK ENDING - ALL A DREAM?', 'THE PERFECT ENDING - HAPPY 44TH!'];
    const extraCols = ['#c77bd6', '#ffd23e'];
    for (let j = 0; j < 2; j++) {
      const i = LVL_META.length + j;
      const sel = i === G.selIdx;
      const y = 64 + i * rowH;
      if (sel) drawText('>', VW / 2 - 140, y, 2, (G.frame >> 3) % 2 ? '#ffe45a' : '#ff5abf');
      drawText(extras[j], VW / 2 - 124, y, 2, sel ? '#fff' : extraCols[j]);
    }
  }
  drawTextC('ENTER: PLAY   TAB: BACK TO TITLE', VW / 2, 268, 1, '#6b5a8c');
}

// ---------------------------------------------------------- screen updates (input)
function titleOptions() {
  return [{ id: 'start', label: 'START GAME' }];
}
function updateTitle() {
  G.frame++;
  if (!titleMusicStarted && G.frame > 5) { audio.play('theme'); titleMusicStarted = true; }
  if (G.saveCache === undefined || G.saveCache === null) G.saveCache = loadSave() || false;
  if (pressed.Enter) {
    audio.sfx('door');
    applySave(G.saveCache || null);
    G.levelSelectRun = false;
    if (G.saveCache) {
      openLevelSelect(); // returning player: straight to the level picker
    } else {
      // brand-new player: the backstory first, then the picker
      G.state = 'story'; G.stateT = 0;
      storyPage = 0; storyChars = 0; lastThunder = 0; flashA = 0;
      audio.play('story');
      audio.tempo(1);
    }
  }
}
// ARCADE BUILD: preload this level's book covers behind a progress bar.
function updateLoading() {
  G.frame++;
  let done = 0;
  for (const b of L.books) {
    const c = covers[b.i];
    if (c && (c.st === 'ok' || c.st === 'fail')) done++;
  }
  G.loadDone = done;
  // Move on when every cover has resolved, or after 15s so a slow or offline
  // network can never trap us on this screen (covers just fall back to sprites).
  const timedOut = performance.now() - G.loadStart > 15000;
  if (done >= G.loadTotal || timedOut) {
    G.state = 'intro';
    G.stateT = 0;
  }
}
function drawLoading() {
  ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, VW, VH);
  const meta = LVL_META[G.level];
  drawTextC('LEVEL ' + (G.level + 1), VW / 2, 92, 3, '#9a86c4');
  drawTextC(meta.name, VW / 2, 122, 2, '#ffd23e', '#3a2410');
  const total = G.loadTotal || 1;
  const frac = Math.max(0, Math.min(1, G.loadDone / total));
  const bw = 300, bh = 16, bx = (VW - bw) / 2, by = 166;
  ctx.fillStyle = '#241a38'; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = '#7de8ff'; ctx.fillRect(bx + 2, by + 2, Math.round((bw - 4) * frac), bh - 4);
  drawTextC('LOADING BOOK COVERS   ' + G.loadDone + ' / ' + total, VW / 2, 196, 1, '#c9b8ec');
  if ((G.frame >> 4) % 2 === 0) drawTextC('PLEASE WAIT...', VW / 2, 214, 1, '#8a76b4');
}
function updateIntro() {
  G.frame++; updateFx();
  if (G.stateT > 20 && pressed.Enter) {
    G.state = 'play';
    audio.play('level');
    audio.sfx('menu');
  }
}
function updateInv() {
  G.frame++;
  const listLen = G.order.length;
  const rows = 20;
  if (keys.ArrowDown && G.frame % 4 === 0) G.invScroll = Math.min(Math.max(0, listLen - rows), G.invScroll + 1);
  if (keys.ArrowUp && G.frame % 4 === 0) G.invScroll = Math.max(0, G.invScroll - 1);
  if (pressed.Tab || pressed.Escape) { G.state = 'play'; audio.sfx('menu'); }
}
function updateCleared() {
  G.frame++; updateFx();
  if (G.stateT > 40 && pressed.Enter) {
    if (G.levelSelectRun) {
      G.levelSelectRun = false;
      openLevelSelect();
    } else {
      // walk the overworld map to the next stop
      G.state = 'map'; G.stateT = 0;
      G.mapT = 0; G.mapArrived = false;
      audio.play('title');
      audio.tempo(1);
      audio.sfx('menu');
    }
  }
}
function updateDead() {
  G.frame++; updateFx();
  if (G.stateT > 40 && pressed.Enter) startLevel(G.level, true);
}
function updateTimeup() {
  G.frame++; updateFx();
  if (G.stateT > 120 || (G.stateT > 40 && pressed.Enter)) startLevel(G.level, true);
}
function updateEnding() {
  G.frame++; updateFx();
  if (G.stateT > 60 && pressed.Enter) {
    G.state = 'title'; G.menuSel = 0; G.saveCache = null; G.levelSelectRun = false;
    audio.play('theme');
  }
}

// ---------------------------------------------------------- draw: screens
function drawTitle() {
  // animated bg
  const grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, '#160b2e'); grad.addColorStop(.7, '#40216e'); grad.addColorStop(1, '#6e2a54');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, VH);
  // floating books bg
  for (let i = 0; i < 14; i++) {
    const x = (i * 137 + G.frame * (0.2 + (i % 3) * 0.12)) % (VW + 40) - 20;
    const y = 30 + (i * 67) % 220 + Math.sin(G.frame * 0.03 + i) * 8;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(floatBook(i, i % 7 === 3), Math.floor(x), Math.floor(y));
    ctx.globalAlpha = 1;
  }
  // logo — kerned tight so 'DR.' and 'RAVEN' don't gap apart
  const bob = Math.sin(G.frame * 0.05) * 3;
  const drawLogo = (cx, y, sc, color, outline) => {
    const w1 = textW('DR.', sc), w2 = textW('RAVEN', sc), gap = 3 * sc;
    const x0 = cx - (w1 + gap + w2) / 2;
    drawText('DR.', x0, y, sc, color, outline);
    drawText('RAVEN', x0 + w1 + gap, y, sc, color, outline);
  };
  drawTextC('THE ADVENTURES OF', VW / 2, 37 + bob, 2, '#7de8ff', '#000');
  drawLogo(VW / 2 + 3, 52 + bob + 3, 6, '#000');
  drawLogo(VW / 2, 52 + bob, 6, '#ffd23e', '#6e2a10');
  drawTextC('THE TIME TRAVELING BOOKWORM', VW / 2, 92 + bob, 2, '#ffb0d8', '#000');
  drawTextC('44 YEARS. 1,026 BOOKS. ONE PSYCHOLOGIST.', VW / 2, 106 + bob, 1, '#c9b8ec', '#000');
  // Birthday banner — angled like a party sticker and gently zooming in and out.
  const birthdayPulse = 1 + Math.sin(G.frame * 0.08) * 0.12;
  ctx.save();
  ctx.translate(104, 42);
  ctx.rotate(-Math.PI / 12);
  ctx.scale(birthdayPulse, birthdayPulse);
  drawTextC('HAPPY BIRTHDAY!', 0, -5, 2, '#fff', '#ff5abf');
  ctx.restore();
  // raven mascot on logo
  ctx.drawImage(SPR.raven, VW / 2 + 78, 30 + bob);
  // dr. raven herself
  const px = VW / 2 - 140, py = 130 + Math.sin(G.frame * 0.06) * 2;
  ctx.drawImage(SPR.stand, Math.floor(px), Math.floor(py));

  // menu
  const save = G.saveCache;
  const opts = titleOptions(save).map(opt => opt.label);
  for (let i = 0; i < opts.length; i++) {
    const sel = i === G.menuSel;
    const y = 138 + i * 16;
    if (sel) {
      const arrowColor = (G.frame >> 4) % 2 ? '#ffe45a' : '#ff5abf';
      const optionW = textW(opts[i], 2);
      drawText('>', VW / 2 - optionW / 2 - 14, y, 2, arrowColor);
      drawText('<', VW / 2 + optionW / 2 + 8, y, 2, arrowColor);
    }
    drawTextC(opts[i], VW / 2, y, 2, sel ? '#fff' : '#9a86c4');
  }

  // story
  drawTextC('JACK THE DOG BLASTED DR. RAVEN 44 YEARS BACK IN TIME!', VW / 2, 190, 1, '#c9b8ec');
  drawTextC('COLLECT ALL 1,026 BOOKS OR LOSE THEM FOREVER!', VW / 2, 200, 1, '#c9b8ec');
  drawTextC("MADELEINE L'ENGLE BOOKS GRANT SUPER READER POWER!", VW / 2, 210, 1, '#ffd23e');

  drawTextC('ARROWS/WASD: MOVE  SPACE: JUMP  ENTER: THROW & DOORS  TAB: BOOKS', VW / 2, 234, 1, '#8a76b4');
  if (!audio.running && (G.frame >> 4) % 2 === 0) drawTextC('~ CLICK OR PRESS ANY KEY FOR MUSIC ~', VW / 2, 222, 1, '#7de8ff', '#000');
  if ((G.frame >> 5) % 2 === 0) drawTextC('PRESS ENTER', VW / 2, 254, 2, '#fff', '#000');
  drawTextC('(C) 2026 RAVENSOFT - 16-BIT THERAPY DIVISION', VW / 2, 276, 1, '#6b5a8c');
}

function drawIntro() {
  ctx.fillStyle = '#0a0612'; ctx.fillRect(0, 0, VW, VH);
  const meta = LVL_META[G.level];
  const n = LEVEL_BOOKS[G.level].length;
  const nl = LEVEL_BOOKS[G.level].filter(i => BOOKS[i].le).length;
  drawTextC('LEVEL ' + (G.level + 1), VW / 2, 70, 3, '#9a86c4');
  drawTextC(meta.name, VW / 2, 100, 3, '#ffd23e', '#3a2410');
  drawTextC(meta.sub, VW / 2, 128, 1, '#c9b8ec');
  ctx.drawImage(bookSprite(2, false), VW / 2 - 62, 148);
  drawText(n + ' BOOKS ON THE LOOSE', VW / 2 - 44, 152, 1, '#fff');
  if (nl > 0) drawTextC('*' + nl + " L'ENGLE POWER BOOK" + (nl > 1 ? 'S' : '') + ' HIDDEN HERE *', VW / 2, 170, 1, '#ffd23e');
  drawTextC('120 SECONDS. REACH THE DOOR. GRAB EVERYTHING.', VW / 2, 192, 1, '#c9b8ec');
  const warn = G.level === 0 ? 'JACK HAS G-DADDY & PEP IN A KENNEL! SET THEM FREE!'
    : G.level === 2 ? 'JACK CAGED CC, UNCLE B, BUTTER & BACON! SET THEM FREE!'
    : G.level === 6 ? 'JACK HAS SCARLETT, HANK & RAMONA IN A CAGE! SET THEM FREE!'
    : G.level === 7 ? 'GIANT JACK IS TWICE AS TALL AND HUNGRY FOR BOOKS!'
    : 'JACK THE DOG GUARDS THE EXIT' + (G.level > 0 ? ' - FASTER THAN BEFORE!' : '!');
  const extra = G.level === 5 ? 'MED STUDENT QUESTIONS COST 10 MINUTES! TOSS THEM A BOOK!' : null;
  drawTextC(warn, VW / 2, 206, 1, '#ff5a5a');
  if (extra) drawTextC(extra, VW / 2, 216, 1, '#7de8ff');
  if (G.stateT > 30 && (G.frame >> 4) % 2 === 0) drawTextC('PRESS ENTER', VW / 2, extra ? 230 : 220, 2, '#fff');
}

function drawOverlayBox() {
  ctx.fillStyle = 'rgba(6,4,12,.88)';
  ctx.fillRect(0, 0, VW, VH);
}

function drawInventory() {
  drawWorld();
  drawOverlayBox();
  drawTextC("DR. RAVEN'S LIBRARY", VW / 2, 12, 2, '#ffd23e', '#000');
  drawTextC(totalCollected() + ' / ' + TOTAL_BOOKS + ' BOOKS   *' + lengleCount() + '/' + TOTAL_LENGLE + " L'ENGLE", VW / 2, 30, 1, '#c9b8ec');

  const list = [...G.order].reverse();
  const rows = 20, rowH = 11, top = 46;
  if (list.length === 0) {
    drawTextC('NO BOOKS YET. GO READ!', VW / 2, 120, 1, '#8a76b4');
  }
  for (let r = 0; r < rows; r++) {
    const li = G.invScroll + r;
    if (li >= list.length) break;
    const bk = BOOKS[list[li]];
    const y = top + r * rowH;
    const col = bk.le ? '#ffd23e' : '#e8e0f8';
    if (bk.le) drawText('*', 8, y, 1, '#ffd23e');
    drawText(trunc(bk.t, 52), 18, y, 1, col);
    drawText(trunc(bk.a, 22), 420, y, 1, '#8a76b4');
  }
  if (list.length > rows) {
    drawTextC('- ' + (G.invScroll + 1) + '-' + Math.min(list.length, G.invScroll + rows) + ' OF ' + list.length + ' -', VW / 2, top + rows * rowH + 2, 1, '#6b5a8c');
  }
  drawTextC('UP/DOWN: SCROLL   TAB: CLOSE', VW / 2, 276, 1, '#8a76b4');
}

function drawCleared() {
  drawWorld(); drawOverlayBox();
  const s = G.clearStats;
  drawTextC('LEVEL CLEAR!', VW / 2, 60, 4, '#ffd23e', '#3a2410');
  drawTextC('BOOKS COLLECTED: ' + s.got + ' / ' + s.of, VW / 2, 110, 2, '#fff');
  drawTextC('FINISHED AT: ' + s.clock, VW / 2, 132, 1, '#c9b8ec');
  drawTextC('LIBRARY TOTAL: ' + G.collected.size + ' / ' + TOTAL_BOOKS, VW / 2, 148, 1, '#c9b8ec');
  if (s.got === s.of) drawTextC('PERFECT SHELF! EVERY BOOK FOUND!', VW / 2, 168, 1, '#5aff8f');
  const prompt = G.levelSelectRun ? 'PRESS ENTER FOR LEVEL SELECT' : 'PRESS ENTER FOR NEXT LEVEL';
  if (G.stateT > 40 && (G.frame >> 4) % 2 === 0) drawTextC(prompt, VW / 2, 210, 1, '#fff');
}

function drawDead() {
  drawWorld(); drawOverlayBox();
  drawTextC('DR. RAVEN NEEDS A', VW / 2, 80, 3, '#ff5a5a');
  drawTextC('READING BREAK...', VW / 2, 106, 3, '#ff5a5a');
  const msg = READING_BREAK_MESSAGES[Math.max(0, readingBreakMessage)];
  drawTextC(msg, VW / 2, 140, 1, '#c9b8ec');
  if (G.stateT > 40 && (G.frame >> 4) % 2 === 0) drawTextC('PRESS ENTER TO TRY AGAIN', VW / 2, 180, 1, '#fff');
}

function drawTimeup() {
  drawWorld(); drawOverlayBox();
  drawTextC("IT'S 8:00 PM!", VW / 2, 72, 4, '#ffb0d8', '#000');
  drawTextC('DR. RAVEN FELL ASLEEP...', VW / 2, 118, 2, '#c9b8ec', '#000');
  drawTextC('THE CHAPTER IS STARTING OVER.', VW / 2, 146, 1, '#ffe45a', '#000');
  const z = 1 + ((G.frame >> 4) % 3);
  drawTextC('Z'.repeat(z), VW / 2, 170, 2, '#7de8ff', '#000');
  if (G.stateT > 40 && (G.frame >> 4) % 2 === 0) drawTextC('PRESS ENTER TO WAKE UP EARLY', VW / 2, 210, 1, '#fff');
}

function drawEnding() {
  const grad = ctx.createLinearGradient(0, 0, 0, VH);
  grad.addColorStop(0, '#160b2e'); grad.addColorStop(1, '#40216e');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, VW, VH);
  for (let i = 0; i < 20; i++) {
    const x = (i * 97 + G.frame * 0.4) % VW;
    const y = (i * 53 + G.frame * (0.3 + i % 3 * 0.1)) % VH;
    ctx.globalAlpha = 0.5;
    ctx.drawImage(floatBook(i, i % 6 === 2), x, y);
    ctx.globalAlpha = 1;
  }
  const got = G.collected.size;
  const pct = got / TOTAL_BOOKS;
  drawTextC('THE LIBRARY IS COMPLETE', VW / 2, 40, 2, '#ffd23e', '#000');
  ctx.drawImage(SPR.stand, VW / 2 - 12, 62);
  ctx.drawImage(SPR.donnie, VW / 2 + 14, 62);
  ctx.drawImage(SPR.raven, VW / 2 + 44, 66);
  // the whole family, safe
  ctx.drawImage(SPR.scarlett, VW / 2 - 64, 80);
  ctx.drawImage(SPR.hank, VW / 2 - 48, 81);
  ctx.drawImage(SPR.ramona, VW / 2 - 32, 81);
  drawTextC(got + ' / ' + TOTAL_BOOKS + ' BOOKS COLLECTED', VW / 2, 110, 2, '#fff', '#000');
  drawTextC('*' + lengleCount() + " / " + TOTAL_LENGLE + " L'ENGLE BOOKS", VW / 2, 130, 1, '#ffd23e', '#000');
  const rank = pct >= 1 ? 'GRAND LIBRARIAN OF THE COSMOS'
    : pct >= .9 ? 'TESSERACT SCHOLAR'
    : pct >= .75 ? 'BOOKWORM SUPREME'
    : pct >= .5 ? 'AVID READER'
    : 'CASUAL BROWSER';
  drawTextC('RANK: ' + rank, VW / 2, 152, 1, '#5aff8f', '#000');
  drawTextC('44 YEARS. 1,026 BOOKS. ONE PSYCHOLOGIST.', VW / 2, 180, 1, '#c9b8ec', '#000');
  drawTextC('JACK THE DOG WENT TO OBEDIENCE SCHOOL.', VW / 2, 192, 1, '#c9b8ec', '#000');
  drawTextC('DR. RAVEN WILL SEE YOU NOW.', VW / 2, 204, 1, '#c9b8ec', '#000');
  drawTextC('THANKS FOR PLAYING!', VW / 2, 224, 2, '#ff5abf', '#000');
  if (G.stateT > 60 && (G.frame >> 4) % 2 === 0) drawTextC('PRESS ENTER', VW / 2, 250, 1, '#fff');
}

// ---------------------------------------------------------- main loop
let last = 0, acc = 0;
let titleMusicStarted = false;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(50, ts - last); last = ts;
  acc += dt;
  let steps = 0;
  while (acc >= 1000 / 60 && steps < 3) {
    step();
    acc -= 1000 / 60;
    steps++;
    // edge keys consumed once per rendered frame set
    for (const k in pressed) delete pressed[k];
  }
  render();
}
function step() {
  G.stateT++;
  switch (G.state) {
    case 'title': updateTitle(); break;
    case 'story': updateStory(); break;
    case 'select': updateSelect(); break;
    case 'map': updateMap(); break;
    case 'cutscene': updateCutscene(); break;
    case 'perfect': updatePerfect(); break;
    case 'perfectEnd': updatePerfectEnd(); break;
    case 'loading': updateLoading(); break;
    case 'intro': updateIntro(); break;
    case 'play': updatePlay(); break;
    case 'inv': updateInv(); break;
    case 'cleared': updateCleared(); break;
    case 'dead': updateDead(); break;
    case 'timeup': updateTimeup(); break;
    case 'ending': updateEnding(); break;
  }
}
function render() {
  switch (G.state) {
    case 'title': drawTitle(); break;
    case 'story': drawStory(); break;
    case 'select': drawSelect(); break;
    case 'map': drawMap(); break;
    case 'cutscene': drawCutscene(); break;
    case 'perfect': drawPerfect(); break;
    case 'perfectEnd': drawPerfectEnd(); break;
    case 'loading': drawLoading(); break;
    case 'intro': drawIntro(); break;
    case 'play': drawWorld(); drawHUD(); drawPowerDrama(); break;
    case 'inv': drawInventory(); break;
    case 'cleared': drawCleared(); break;
    case 'dead': drawDead(); break;
    case 'timeup': drawTimeup(); break;
    case 'ending': drawEnding(); break;
  }
}
// try to start audio right away — browsers that trust this site (or have autoplay
// enabled) get title music on load; everyone else gets it on their first key/click
audio.unlock();
// preview hooks: open index.html#perfect to watch the perfect ending without
// collecting all 1,026 books first, #beach to jump to its finale, or #l1..#l8
// to drop straight into a level
const lvlHash = location.hash.match(/^#l([1-8])$/);
if (location.hash === '#perfect') startPerfect();
else if (location.hash === '#beach') { G.state = 'perfectEnd'; G.stateT = 0; audio.play('happy'); }
else if (lvlHash) {
  applySave(loadSave());
  startLevel(+lvlHash[1] - 1, true, true); // preview bypasses level locks
  if (G.state === 'intro') { G.state = 'play'; audio.play('level'); }
}
requestAnimationFrame(loop);
