(function () {
  "use strict";
  // Custom renderer interface of halo-plugin-vditor / vditor-mde.
  // This file is loaded as text, then invoked as a function by the plugin.
  var serial = 0;
  var stylesheetId = "nqs-vditor-style-v1";
  var css = String.raw`
.nqs-report{margin:1em 0;color:inherit;font-family:inherit;font-size:14px;line-height:1.6;white-space:normal;}
.nqs-report,.nqs-report *{box-sizing:border-box;}
.nqs-tabs{border:1px solid #434343;border-radius:9px;background:#292929;color:#eee;padding:12px;max-width:100%;margin:12px 0;}
.nqs-tab-list{display:flex;align-items:flex-end;gap:4px;overflow-x:auto;scrollbar-width:thin;border-bottom:1px solid #484848;padding:0 0 0 2px;white-space:nowrap;}
.nqs-tab{cursor:pointer;flex-shrink:0;font:inherit;font-size:14px;color:#bcbcbc;background:transparent;border:1px solid transparent;border-radius:6px 6px 0 0;padding:9px 13px;line-height:1.3;}
.nqs-tab:hover{background:#383838;color:#fff;}
.nqs-tab[aria-selected="true"]{background:#383838;border-color:#434343;color:#fff;font-weight:600;}
.nqs-tab:focus-visible{outline:2px solid #6ca9ff;outline-offset:-2px;}
.nqs-panels{background:#292929;padding:14px 4px 3px;}
.nqs-panel[hidden]{display:none!important;}
.nqs-terminal{display:block;max-width:100%;overflow:auto;max-height:650px;scrollbar-width:thin;border-radius:7px;background:#1e1e1e;color:#f1f1f1;padding:22px 25px;margin:0;font:600 13px/1.47 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace;white-space:pre;tab-size:4;text-align:left;text-shadow:none;}
.nqs-line{margin:7px 0;}
.nqs-line a{color:#80bbff!important;}
.nqs-line img{display:block;max-width:100%;height:auto;border-radius:6px;margin:8px 0;}
.nqs-report .nqs-tab-content{color:#ddd;}
.nqs-report a{overflow-wrap:anywhere;}
.nqs-code-block{background:#1e1e1e;color:#ddd;border-radius:7px;padding:16px;overflow:auto;}
/* Halo front-end may keep the code element created for a fenced block. */
code.language-nodeseek, .vditor-reset code.language-nodeseek{display:block!important;background:transparent!important;border:0!important;padding:0!important;white-space:normal!important;font:inherit!important;color:inherit!important;}
pre:has(> code.language-nodeseek){padding:0!important;margin:0!important;border:0!important;background:transparent!important;white-space:normal!important;overflow:visible!important;}
@media(max-width:650px){.nqs-tabs{padding:6px}.nqs-panels{padding:9px 2px 1px}.nqs-tab{padding:8px 10px}.nqs-terminal{font-size:11px;padding:12px}}
`;

  function ensureStyles() {
    if (typeof document === "undefined" || document.getElementById(stylesheetId)) return;
    var style = document.createElement("style");
    style.id = stylesheetId;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function safeUrl(url) {
    var u = String(url).trim();
    // Allow normal web/relative URLs only, never data: or javascript:.
    if (/^https?:\/\//i.test(u) || /^\/(?!\/)/.test(u) || /^\.\.?\//.test(u) || /^#/i.test(u)) return escapeHtml(u);
    return "";
  }

  function renderInline(text) {
    // Limited Markdown inline rendering for links; escape all untrusted text.
    var s = String(text);
    var re = /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+|\/(?!\/)[^\s)]*|#[^\s)]*)\)/g;
    var chunks = [], last = 0, m;
    while ((m = re.exec(s))) {
      chunks.push(escapeHtml(s.slice(last, m.index)));
      var href = safeUrl(m[2]);
      chunks.push(href ? '<a href="' + href + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(m[1]) + "</a>" : escapeHtml(m[0]));
      last = re.lastIndex;
    }
    chunks.push(escapeHtml(s.slice(last)));
    return chunks.join("");
  }

  var normal = ["#171717", "#e45e66", "#67c847", "#d8bb52", "#5ba7e5", "#cb81d2", "#4ec6cf", "#ebebeb"];
  var bright = ["#888888", "#ff7078", "#86e65b", "#f8dc67", "#81bdff", "#e59ae6", "#7eeaf0", "#fff"];
  function rgbIndex(n) {
    if (n < 16) return (n < 8 ? normal : bright)[n % 8];
    if (n < 232) {
      var k = n - 16, vals = [0,95,135,175,215,255];
      var r = vals[Math.floor(k / 36)], g = vals[Math.floor(k / 6) % 6], b = vals[k % 6];
      return "rgb(" + r + "," + g + "," + b + ")";
    }
    var c = 8 + (n - 232) * 10;
    return "rgb(" + c + "," + c + "," + c + ")";
  }
  function ansiToHtml(data) {
    var input = String(data).replace(/\r\n?/g, "\n").replace(/\u0008/g, "");
    var state = {fg:null,bg:null,bold:false,italic:false,underline:false,dim:false,inverse:false,strike:false};
    function clear() {state={fg:null,bg:null,bold:false,italic:false,underline:false,dim:false,inverse:false,strike:false};}
    function apply(seq) {
      var p = seq.length ? seq.split(";").map(function (x) {return Number(x || "0");}) : [0];
      for (var i = 0; i < p.length; i++) {
        var v = p[i];
        if(v===0) clear();
        else if(v===1) state.bold=true;
        else if(v===2) state.dim=true;
        else if(v===3) state.italic=true;
        else if(v===4) state.underline=true;
        else if(v===7) state.inverse=true;
        else if(v===9) state.strike=true;
        else if(v===22) {state.bold=false;state.dim=false;}
        else if(v===23) state.italic=false;
        else if(v===24) state.underline=false;
        else if(v===27) state.inverse=false;
        else if(v===29) state.strike=false;
        else if(v===39) state.fg=null;
        else if(v===49) state.bg=null;
        else if(v>=30&&v<=37) state.fg=normal[v-30];
        else if(v>=40&&v<=47) state.bg=normal[v-40];
        else if(v>=90&&v<=97) state.fg=bright[v-90];
        else if(v>=100&&v<=107) state.bg=bright[v-100];
        else if(v===38||v===48) {
          var key=v===38?'fg':'bg';
          if(p[i+1]===5 && i+2<p.length){state[key]=rgbIndex(Math.max(0,Math.min(255,p[i+2])));i+=2;}
          else if(p[i+1]===2 && i+4<p.length){
            var rgb=p.slice(i+2,i+5).map(function(z){return Math.max(0,Math.min(255,z|0));});
            state[key]='rgb('+rgb.join(',')+')'; i+=4;
          }
        }
      }
    }
    function chunk(s) {
      if (!s) return "";
      var fg=state.inverse?state.bg:state.fg, bg=state.inverse?state.fg:state.bg;
      var rules=[];
      if (fg) rules.push('color:'+fg);
      if (bg) rules.push('background-color:'+bg);
      if (state.bold) rules.push('font-weight:800');
      if (state.dim) rules.push('opacity:.7');
      if (state.italic) rules.push('font-style:italic');
      if (state.underline||state.strike) rules.push('text-decoration:'+[state.underline?'underline':'',state.strike?'line-through':''].filter(Boolean).join(' '));
      // Drop C0 control characters apart from tab and newline (already escaped).
      s=s.replace(/[\x00-\x08\x0b-\x1a\x1c-\x1f\x7f]/g, '');
      return rules.length?'<span style="'+rules.join(';')+'">'+escapeHtml(s)+'</span>':escapeHtml(s);
    }
    var out='', last=0, match, re=/\x1b\[([0-9;]*)m/g;
    while((match=re.exec(input))){
      out+=chunk(input.slice(last,match.index));
      apply(match[1]); last=re.lastIndex;
    }
    out+=chunk(input.slice(last));
    return '<pre class="nqs-terminal">'+out+'</pre>';
  }

  function renderLoose(lines) {
    var out=[],i=0;
    while(i<lines.length){
      var line=lines[i], f=line.match(/^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/);
      if(f){
        var inner=[], delim=f[1], lang=f[2].toLowerCase();i++;
        while(i<lines.length&&!new RegExp('^\\s*'+delim[0]+'{'+delim.length+',}\\s*$').test(lines[i])) inner.push(lines[i++]);
        if(i<lines.length)i++;
        out.push(lang==='ansi'?ansiToHtml(inner.join('\n')):'<pre class="nqs-code-block">'+escapeHtml(inner.join('\n'))+'</pre>');
        continue;
      }
      var im=line.match(/^\s*!\[([^\]]*)\]\(([^\s)]+)(?:\s+"[^"]*")?\)\s*$/);
      if(im){var src=safeUrl(im[2]);if(src)out.push('<div class="nqs-line"><img loading="lazy" src="'+src+'" alt="'+escapeHtml(im[1])+'"></div>');else out.push('<p class="nqs-line">'+escapeHtml(line)+'</p>');i++;continue;}
      if(!line.trim()){i++;continue;}
      out.push('<p class="nqs-line">'+renderInline(line)+'</p>');i++;
    }
    return out.join('');
  }

  function renderTabs(panels) {
    if(!panels.length)return '';
    var sid='nqs-'+(++serial);
    var tabs=panels.map(function(p,i){return '<button type="button" class="nqs-tab" role="tab" id="'+sid+'-t'+i+'" aria-controls="'+sid+'-p'+i+'" aria-selected="'+(i===0?'true':'false')+'" tabindex="'+(i===0?'0':'-1')+'">'+escapeHtml(p.title)+'</button>';}).join('');
    var content=panels.map(function(p,i){return '<section class="nqs-panel nqs-tab-content" role="tabpanel" id="'+sid+'-p'+i+'" aria-labelledby="'+sid+'-t'+i+'"'+(i?' hidden':'')+'>'+renderLoose(p.lines)+'</section>';}).join('');
    return '<div class="nqs-tabs"><div class="nqs-tab-list" role="tablist" aria-label="测评项目">'+tabs+'</div><div class="nqs-panels">'+content+'</div></div>';
  }

  function render(content) {
    ensureStyles();
    var lines=String(content).replace(/\r\n?/g,'\n').split('\n');
    var out=[],i=0;
    while(i<lines.length){
      if(/^\s*:{4,}\s+tabs\s*$/i.test(lines[i])){
        i++;var panels=[],panel=null;
        while(i<lines.length && !/^\s*:{4,}\s*$/.test(lines[i])){
          var m=lines[i].match(/^\s*:{3}\s+tab-item\s+(.+)$/i);
          if(m){if(panel)panels.push(panel);panel={title:m[1].trim(),lines:[]};i++;continue;}
          if(/^\s*:{3}\s*$/.test(lines[i])){if(panel){panels.push(panel);panel=null;}i++;continue;}
          if(panel)panel.lines.push(lines[i]);i++;
        }
        if(panel)panels.push(panel);
        if(i<lines.length)i++;
        out.push(renderTabs(panels));
      }else{
        var block=[];
        while(i<lines.length&&!/^\s*:{4,}\s+tabs\s*$/i.test(lines[i]))block.push(lines[i++]);
        out.push(renderLoose(block));
      }
    }
    return '<div class="nqs-report">'+out.join('')+'</div>';
  }

  // Event delegation survives Vditor re-rendering and works for both the Halo
  // console and the public article pages. No inline onclick handlers required.
  if(typeof document!=='undefined' && !document.__nqsRendererClicksV1){
    document.__nqsRendererClicksV1=true;
    document.addEventListener('click',function(event){
      var el=event.target;
      if(!el || !el.closest)return;
      var tab=el.closest('.nqs-tab');
      if(!tab)return;
      var tabs=tab.closest('.nqs-tabs');
      if(!tabs)return;
      var list=tab.closest('.nqs-tab-list');
      var buttons=Array.from(list.querySelectorAll('.nqs-tab'));
      var idx=buttons.indexOf(tab),sections=Array.from(tabs.querySelectorAll('.nqs-panels > .nqs-panel'));
      if(idx<0)return;
      buttons.forEach(function(btn,i){btn.setAttribute('aria-selected',i===idx?'true':'false');btn.setAttribute('tabindex',i===idx?'0':'-1');});
      sections.forEach(function(section,i){section.hidden=i!==idx;});
    });
    document.addEventListener('keydown',function(event){
      if(!event.target || !event.target.closest)return;
      var tab=event.target.closest('.nqs-tab');if(!tab)return;
      var buttons=Array.from(tab.closest('.nqs-tab-list').querySelectorAll('.nqs-tab'));
      var i=buttons.indexOf(tab),next;
      if(event.key==='ArrowRight')next=(i+1)%buttons.length;
      else if(event.key==='ArrowLeft')next=(i-1+buttons.length)%buttons.length;
      else if(event.key==='Home')next=0;
      else if(event.key==='End')next=buttons.length-1;
      else return;
      event.preventDefault();buttons[next].click();buttons[next].focus();
    });
  }
  ensureStyles();
  return {language:'nodeseek',render:render};
})
