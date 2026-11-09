/* Offline joseki tree explorer. Source assessments are data, never engine analysis. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const E = window.GoEngine;
  const K = window.JosekiKnowledge;
  const R = window.JosekiReview;
  const C = window.JosekiContext;
  const db = window.JOSEKI_DB || {nodes: [], roots: [], collections: [], sources: [], stats: {}};
  const nodes = db.nodes;
  const originalRoots = [...db.roots];
  const sourceMap = new Map(db.sources.map(source => [source.id, source]));
  const curatedRoots = [];
  const qualityOrder = {good: 0, unknown: 1, questionable: 2, bad: 3};
  const qualityText = {good: '棋谱推荐', unknown: '未评级', questionable: '有条件 / 疑问', bad: '不推荐 · 原谱错着'};
  const qualityColors = {good: ['#559772', '#2c7252', '#ffffff'], unknown: ['#c5cec0', '#8e9d88', '#445840'], questionable: ['#d7bb7d', '#ad8c4c', '#594b2f'], bad: ['#c78370', '#a85648', '#ffffff']};
  const parseMoves = text => [...(text || '').matchAll(/([BW])\[([a-s])([a-s])\]/g)].map(m => ({color:m[1], x:m[2].charCodeAt(0)-97, y:m[3].charCodeAt(0)-97}));
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const safeURL = url => /^https?:\/\//.test(url || '') ? url : '';
  const fmt = number => Number(number || 0).toLocaleString('en-US');
  const colorText = color => color==='B'?'黑棋':'白棋';
  for (const item of window.CURATED_JOSEKI || []) {
    const sourceId = 'curated-' + item.id;
    sourceMap.set(sourceId, {id:sourceId, name:item.sourceLabel?.replace(/查看| ↗/g,'') || 'Pachi · 中文精选', url:item.source || 'https://github.com/pasky/pachi/blob/master/joseki/joseki_34.sgf'});
    const root = {id:nodes.length,parent:null,children:[],move:null,quality:'unknown',name:item.title,comment:item.intro,sourceId,setup:parseMoves(item.setup),toPlay:item.toPlay||parseMoves(item.moves)[0]?.color||'B',curated:true,item};
    nodes.push(root); curatedRoots.push(root.id);
    let parent = root;
    parseMoves(item.moves).forEach((move, index) => {
      const node = {id:nodes.length,parent:parent.id,children:[],move,quality:'good',qualityEvidence:'有来源的精选变化，不代表全盘最优',name:'',comment:item.notes?.[index+1] || '',sourceId,curated:true,depth:index+1};
      nodes.push(node); parent.children.push(node.id); parent=node;
    });
  }
  if (!E) { $('board-loading').textContent='棋盘引擎未加载，请刷新页面。'; return; }
  let orientation = 0, history = [], cursor = 0, candidates = [], currentPreview = null;
  let activePreset = 'empty', libraryFilter = 'all', toastTimer = null;
  let wheelAmount = 0, lastWheelTime = 0, wheelFrame = null, processingWheel = false, previewPinned = false;
  const wheelStep = 100, wheelIdleTime = 200;
  let libraryEntries = [];
  const current = () => history[cursor];
  const localPosition = frame => frame.localPosition || frame.position;
  const rootOf = id => { let node=nodes[id]; while(node && node.parent!==null && node.parent!==undefined) node=nodes[node.parent]; return node; };
  function ancestry(id) { const path=[]; for(let node=nodes[id];node;node=node.parent==null?null:nodes[node.parent])path.push(node); return path.reverse(); }
  const descriptions = new Map();
  function describeNode(id) {
    if(id == null)return {title:'',moveName:'',sourceIds:[]};
    if(!descriptions.has(id)){
      const path=ancestry(id);
      descriptions.set(id,K?.describe({moves:path.filter(n=>n.move).map(n=>n.move),setup:path.flatMap(n=>n.setup||[])})||{title:'',moveName:'',sourceIds:[]});
    }
    return descriptions.get(id);
  }
  function nodeTitle(id) { return describeNode(id).title; }
  function sourcePreference(entry,position) {
    const node=nodes[entry.nodeId],review=R?.choice(position,node.move);
    return review?.next&&Number(node.externalId)===review.next.externalId ? 0 : 1;
  }
  function candidateColors(candidate) {
    if(candidate.review?.primary)return ['#347e55','#22643f','#ffffff'];
    if(candidate.review?.legacy&&candidate.quality==='good')return ['#aec3a5','#8ea584','#354c2f'];
    return qualityColors[candidate.quality];
  }
  function candidateAssessment(candidate) {
    if(candidate.review?.primary)return '首选参考';
    if(candidate.review?.conditional)return '有条件';
    if(candidate.review?.legacy)return '旧库支线';
    if(candidate.review?.next&&candidate.review.order===1)return '来源优先参考';
    return qualityText[candidate.quality];
  }
  function reviewText(text,match) {
    if(!text||!match)return text||'';
    return text.replace(/\b[A-HJ-T](?:1[0-9]|[1-9])\b/g,coordinate=>{
      const point=E.parseCoordinates(coordinate);return E.coordinates(displayPoint(E.transformPoint(point,match.symmetry)));
    });
  }
  function compareCandidates(a,b) {
    if((a.quality==='bad')!==(b.quality==='bad'))return a.quality==='bad'?1:-1;
    const ar=a.review?.next?0:1,br=b.review?.next?0:1;
    return ar-br || ((a.review?.order??Infinity)-(b.review?.order??Infinity)) || qualityOrder[a.quality]-qualityOrder[b.quality] || Number(!!a.move.pass)-Number(!!b.move.pass) || a.move.y-b.move.y || a.move.x-b.move.x || a.move.color.localeCompare(b.move.color);
  }
  function applySetup(position, setup) {
    if (!setup?.length) return position;
    const next = {...position, board:[...position.board], numbers:[...position.numbers], previousBoard:null};
    for(const point of setup){ next.board[point.y*19+point.x] = ['B','W'].includes(point.color) ? point.color : null; next.numbers[point.y*19+point.x] = 0; }
    return next;
  }
  function applyEntry(position, entry, sourceReplay=false) {
    let next=position;const appliedSetup={};
    for(const id of entry.actions){
      const node=nodes[id];
      if(!sourceReplay&&node.setup?.length){
        // A source diagram may add required setup stones, but must never
        // overwrite a real move played elsewhere or erase its move number.
        const additions=[];
        for(const point of node.setup){
          const stone=next.board[point.y*19+point.x],required=['B','W'].includes(point.color)?point.color:null;
          if(stone===required)continue;
          if(stone)return {ok:false,position,message:'此分支的原谱配子与实际棋子冲突。'};
          additions.push(point);
        }
        appliedSetup[id]=additions;
        next=applySetup(next,additions);
      }else {appliedSetup[id]=node.setup||[];next=applySetup(next,node.setup);}
      if(node.move){
        if(!sourceReplay&&node.move.color!==next.toPlay)return {ok:false,position,message:`当前轮到${colorText(next.toPlay)}。`};
        const result=E.play(next,node.move); if(!result.ok)return result; next=result.position;
      }
      // PL may specify the initial player of a setup diagram. Once a move
      // exists, the board always offers the opposite color next.
      if(sourceReplay&&node.toPlay&&!next.lastMove) next={...next,toPlay:node.toPlay};
    }
    return {ok:true,position:next,appliedSetup};
  }
  function edges(refs) {
    const result=[];
    function visit(id, actions, seen) {
      if(seen.has(id))return;
      const node=nodes[id]; if(!node || node.invalid)return;
      const nextActions=[...actions,id];
      if(node.move){result.push({nodeId:id,actions:nextActions});return;}
      const nextSeen=new Set(seen); nextSeen.add(id);
      for(const child of node.children)visit(child,nextActions,nextSeen);
    }
    for(const id of refs) for(const child of nodes[id]?.children || []) visit(child,[],new Set());
    return result;
  }
  function candidateGroups(frame, includeBad=true) {
    const groups = new Map();
    const emptyOpening=frame.position.moveNumber===0&&!frame.position.board.some(Boolean);
    for(const entry of edges(frame.refs)){
      const node=nodes[entry.nodeId];
      // Pachi's Q3 -> R9 starts a Chinese-opening diagram with two Black moves.
      // Do not offer its isolated Q3 as an empty-board joseki entry. Keep the
      // source sequence available when studying that diagram or actual tenuki.
      if(emptyOpening&&node.sourceId==='pachi'&&node.sourceFile==='joseki_34.sgf'&&node.sourceNode===975)continue;
      if(node.move.color!==frame.position.toPlay)continue;
      const result=applyEntry(frame.position,entry);
      if(!result.ok) continue;
      // Different setup diagrams are separate choices, even at the same coordinate.
      const signature=node.move.color+':'+node.move.x+','+node.move.y+':'+result.position.toPlay+':'+result.position.board.map(x=>x||'.').join('')+':'+JSON.stringify([result.position.previousBoard,result.position.numbers,result.position.captures]);
      if(!groups.has(signature))groups.set(signature,{key:signature,move:node.move,entries:[],quality:node.quality});
      groups.get(signature).entries.push(entry);
    }
    const list=[...groups.values()];
    for(const candidate of list){
      candidate.entries.sort((a,b)=>qualityOrder[nodes[a.nodeId].quality]-qualityOrder[nodes[b.nodeId].quality] || sourcePreference(a,localPosition(frame))-sourcePreference(b,localPosition(frame)) || a.nodeId-b.nodeId);
      const ratings=new Set(candidate.entries.map(entry=>nodes[entry.nodeId].quality));
      candidate.conflict=ratings.has('good')&&ratings.has('bad');
      candidate.quality=candidate.conflict?'questionable':nodes[candidate.entries[0].nodeId].quality;
      candidate.conditional=candidate.entries.some(entry=>entry.actions.some(id=>nodes[id].setup?.length));
      candidate.review=R?.choice(localPosition(frame),candidate.move)||null;
      const verifiedQuality={IDEAL:'good',GOOD:'questionable',QUESTION:'questionable',TRICK:'questionable',MISTAKE:'bad'}[candidate.review?.next?.category];
      if(verifiedQuality){
        candidate.conflict ||= (candidate.quality==='bad')!==(verifiedQuality==='bad');
        candidate.quality=verifiedQuality;
      }
      if((candidate.conditional||candidate.review?.conditional) && candidate.quality==='good')candidate.quality='questionable';
    }
    // Number visible intersections, not source/setup variants. A pass has no
    // intersection; different conditions at one point share its number.
    const pointNumbers=new Map();
    return list.filter(candidate=>includeBad||candidate.quality!=='bad').sort(compareCandidates).map(candidate=>{
      if(candidate.move.pass)return {...candidate,number:null};
      const point=candidate.move.x+','+candidate.move.y;
      if(!pointNumbers.has(point))pointNumbers.set(point,pointNumbers.size+1);
      return {...candidate,number:pointNumbers.get(point)};
    });
  }
  const displayPoint = move => move.pass ? {x:-1,y:-1} : E.transformPoint(move,orientation);
  const pointText = move => move.pass?'脱先':E.coordinates(displayPoint(move));
  function entryLabel(candidate) {
    return candidateDetail(candidate);
  }
  function candidateDetail(candidate) {
    const reviewed=candidate.review;
    if(reviewed?.note)return reviewed.note.label+(reviewed.primary?' · 首选参考':reviewed.conditional?(/征子|ladder/i.test(reviewed.note.condition||reviewed.note.note)?' · 看征子':' · 看条件'):reviewed.legacy?' · 旧库支线':'');
    const moveName=describeNode(candidate.entries[0].nodeId).moveName;
    if(candidate.conflict) return (moveName?moveName+' · ':'')+'来源标注有分歧';
    if(candidate.conditional) return (moveName?moveName+' · ':'')+'另有配子条件';
    return moveName||qualityText[candidate.quality].replace(' · 原谱错着','');
  }
  function emptyFrame(rootIds=originalRoots) { const position=E.createPosition();return {position,localPosition:position,refs:rootIds,nodeId:null,actions:[],free:false}; }
  function reset(rootIds=originalRoots) { history=[emptyFrame(rootIds)];cursor=0;activePreset='empty';hidePreview(true);render(); }
  function pushEntry(entry, refs, renderNow=true,sourceReplay=false) {
    const before=current(),result=applyEntry(before.position,entry,sourceReplay);
    if(!result.ok){toast(result.message || '原谱在此处无法按围棋规则继续。');return false;}
    history=history.slice(0,cursor+1);
    const local=applyEntry(localPosition(before),entry,sourceReplay);
    const matches=local.ok&&local.position.board.every((stone,i)=>!stone&&!localPosition(before).board[i]||result.position.board[i]===stone);
    history.push({position:result.position,localPosition:local.ok?local.position:result.position,refs:matches?(refs || [entry.nodeId]):[],nodeId:entry.nodeId,actions:entry.actions,appliedSetup:result.appliedSetup,sourceReplay,detached:before.detached&&matches,free:!matches});cursor++;
    if(renderNow){hidePreview(true);render();} return true;
  }
  function playCandidate(candidate) { if(!candidate)return;pushEntry(candidate.entries[0],candidate.entries.map(entry=>entry.nodeId)); }
  function playBoardCandidate(candidate) {
    if(!candidate)return;
    playCandidate(candidate);
  }
  function playFree(point,renderNow=true) {
    const before=current(),move={...point,color:before.position.toPlay},result=E.play(before.position,move);
    if(!result.ok){toast(result.message);return;}
    const retained=C.retain(before,result,move);
    history=history.slice(0,cursor+1);history.push({position:result.position,localPosition:retained?.localPosition||result.position,refs:retained?.refs||[],nodeId:null,studyNodeId:retained?(before.nodeId??before.studyNodeId):null,actions:[],free:!retained,detached:!!retained,freeMove:move});cursor++;
    if(renderNow){hidePreview(true);render();}return true;
  }
  function goTo(step) { cursor=Math.max(0,Math.min(history.length-1,step));hidePreview(true);render(); }
  function advance() {
    if(cursor<history.length-1){goTo(cursor+1);return;}
    const candidate=R.continuation(candidates,current().position.toPlay);
    if(candidate&&!candidate.move.pass)playCandidate(candidate);
    else if(candidate?.move.pass)toast('此处可以脱先，请在棋盘上选择实际落点。');
    else if(candidates.length)toast('此处分支没有唯一的来源优先应法，请先选择一个落点。');
  }
  function loadNode(id, before=false) {
    const path=ancestry(id); if(!path.length)return;
    const targetPath=before?path.slice(0,-1):path;
    const root=path[0];
    let base=applySetup(E.createPosition(),root.setup);
    if(root.toPlay)base={...base,toPlay:root.toPlay};
    history=[{position:base,localPosition:base,refs:[root.id],nodeId:root.id,actions:root.setup?.length?[root.id]:[],free:false}];cursor=0;
    let pending=[];
    for(const node of targetPath.slice(1)){
      pending.push(node.id);
      if(node.move){if(!pushEntry({nodeId:node.id,actions:pending},[node.id],false,true))break;pending=[];}
    }
    if(pending.length){const result=applyEntry(current().position,{actions:pending},true);if(result.ok)history[cursor]={...current(),position:result.position,localPosition:result.position,refs:[pending.at(-1)],nodeId:pending.at(-1),actions:[...current().actions,...pending]};}
    activePreset=root.item?.corner || root.name?.split(' · ')[0] || '';
    hidePreview(true);render();
  }
  function svgBoard(position,{preview=false,choices=[],offset=0}={}) {
    const size=preview?400:640,stones=[];
    for(let i=0;i<361;i++)if(position.board[i])stones.push({...displayPoint({x:i%19,y:Math.floor(i/19)}),color:position.board[i],number:position.numbers[i]});
    let xmin=0,ymin=0,span=18;
    if(preview&&stones.length){
      const minX=Math.min(...stones.map(p=>p.x)),maxX=Math.max(...stones.map(p=>p.x)),minY=Math.min(...stones.map(p=>p.y)),maxY=Math.max(...stones.map(p=>p.y));
      span=Math.min(18,Math.max(9,maxX-minX+3,maxY-minY+3));
      xmin=Math.max(0,Math.min(18-span,Math.floor((minX+maxX-span)/2)));ymin=Math.max(0,Math.min(18-span,Math.floor((minY+maxY-span)/2)));
    }
    const pad=preview?24:35,gap=(size-pad*2)/span,px=x=>pad+(x-xmin)*gap,py=y=>pad+(y-ymin)*gap;
    const prefix=preview?'preview':'main';
    let svg=`<defs><radialGradient id="${prefix}-black" cx="32%" cy="24%" r="76%"><stop offset="0" stop-color="#4e524b"/><stop offset=".55" stop-color="#282d27"/><stop offset="1" stop-color="#171d18"/></radialGradient><radialGradient id="${prefix}-white" cx="32%" cy="24%" r="85%"><stop offset="0" stop-color="#fffffc"/><stop offset=".65" stop-color="#f3f1e9"/><stop offset="1" stop-color="#d6d7cb"/></radialGradient><pattern id="${prefix}-grain" width="45" height="70" patternUnits="userSpaceOnUse"><path d="M0 8Q20 5 45 9M0 44Q28 48 45 44M0 64Q10 62 45 64" stroke="#a88651" fill="none" opacity=".07" stroke-width=".6"/></pattern></defs><rect width="${size}" height="${size}" fill="url(#${prefix}-grain)"/><g class="board-grid">`;
    for(let i=0;i<=span;i++)svg+=`<path d="M${px(xmin+i)} ${pad}V${size-pad}M${pad} ${py(ymin+i)}H${size-pad}"/>`;
    svg+='</g>';
    for(const x of [3,9,15])for(const y of [3,9,15])if(x>=xmin&&x<=xmin+span&&y>=ymin&&y<=ymin+span)svg+=`<circle cx="${px(x)}" cy="${py(y)}" r="${preview?2.2:2.6}" fill="#786647"/>`;
    for(let i=0;i<=span;i++){
      const letter='ABCDEFGHJKLMNOPQRST'[xmin+i],number=19-ymin-i;
      svg+=`<text class="board-coordinate" x="${px(xmin+i)}" y="${pad*.39}">${letter}</text><text class="board-coordinate" x="${px(xmin+i)}" y="${size-pad*.39}">${letter}</text><text class="board-coordinate" x="${pad*.39}" y="${py(ymin+i)}">${number}</text><text class="board-coordinate" x="${size-pad*.39}" y="${py(ymin+i)}">${number}</text>`;
    }
    for(const stone of stones){
      const x=px(stone.x),y=py(stone.y),r=gap*.462,isBlack=stone.color==='B';
      svg+=`<circle cx="${x+.7}" cy="${y+1.7}" r="${r}" fill="#3a2f2035"/><circle cx="${x}" cy="${y}" r="${r}" fill="url(#${prefix}-${isBlack?'black':'white'})" stroke="${isBlack?'#1b201b':'#c9cbbd'}" stroke-width=".6"/>`;
      const number=preview?(stone.number>offset?stone.number-offset:0):($('show-numbers').checked?stone.number:0);
      if(number)svg+=`<text class="stone-number" style="font-size:${Math.min(13,gap*.37)}px" fill="${isBlack?'#f4f2df':'#3a4537'}" x="${x}" y="${y+.4}">${number}</text>`;
    }
    if(!preview&&position.lastMove&&!position.lastMove.pass){const last=displayPoint(position.lastMove);svg+=`<circle cx="${px(last.x)}" cy="${py(last.y)}" r="${gap*.38}" fill="none" stroke="#d4ae60" stroke-width="1.4" pointer-events="none"/>`;}
    if(!preview){
      // Full intersection hit targets support free moves and keyboard access.
      svg+='<g class="intersection-targets">';
      for(let y=0;y<19;y++)for(let x=0;x<19;x++)svg+=`<rect x="${px(x)-gap/2}" y="${py(y)-gap/2}" width="${gap}" height="${gap}" fill="transparent" data-x="${x}" data-y="${y}"/>`;
      svg+='</g>';
      const rendered=new Set();
      choices.forEach((candidate,index)=>{
        if(candidate.move.pass)return;const point=displayPoint(candidate.move),key=`${point.x},${point.y}`;if(rendered.has(key))return;rendered.add(key);
        const [fill,stroke,textColor]=candidateColors(candidate);
        svg+=`<g class="candidate-mark" data-candidate="${index}" role="button" tabindex="0" aria-label="候选 ${candidate.number}，${colorText(candidate.move.color)} ${pointText(candidate.move)}，${escape(entryLabel(candidate))}"><circle cx="${px(point.x)}" cy="${py(point.y)}" r="${gap*.39}" fill="${fill}" stroke="${stroke}"/><text x="${px(point.x)}" y="${py(point.y)+.5}" fill="${textColor}">${candidate.number}</text></g>`;
      });
    }
    return svg;
  }
  function frameContext() { const id=current().nodeId??current().studyNodeId;return id!=null?nodes[id]:null; }
  function render() {
    if(!processingWheel)resetWheelGesture();
    const frame=current(),node=frameContext(),p=frame.position;
    candidates=candidateGroups(frame,$('show-bad').checked);
    // Group only the presentation, keeping full-state choices and refs separate.
    const groupedChoices=new Map();
    candidates.forEach((candidate,index)=>{
      const key=candidate.number??'pass';
      if(!groupedChoices.has(key))groupedChoices.set(key,[]);
      groupedChoices.get(key).push({candidate,index});
    });
    const pointCount=groupedChoices.size-Number(groupedChoices.has('pass'));
    $('main-board').innerHTML=svgBoard(p,{choices:candidates});
    $('board-loading').hidden=true;
    $('move-counter').textContent=`第 ${p.moveNumber} 手`;
    $('timeline').max=history.length-1;$('timeline').value=cursor;
    $('first').disabled=$('previous').disabled=cursor===0;
    $('last').disabled=cursor===history.length-1;
    $('next').disabled=cursor===history.length-1&&!candidates.some(c=>c.quality!=='bad');
    $('next').title=cursor<history.length-1?'重放下一手':R.continuation(candidates,p.toPlay)?'按来源建议前进一步':'此处需要选择下一手';
    $('turn-stone').className=`turn-stone ${p.toPlay==='B'?'black':'white'}`;
    $('turn-label').textContent=(p.toPlay==='B'?'黑':'白')+(p.moveNumber?'棋行棋':'棋先行');
    $('position-badge').textContent=frame.free?'自由研究 · 未收录':frame.detached?'脱先后 · 局部继续':'定式库内';
    $('position-badge').classList.toggle('free',frame.free);
    const title=frame.free?'走出已收录的变化':(frame.nodeId??frame.studyNodeId)==null?'从角上开始':nodeTitle(frame.nodeId??frame.studyNodeId);
    $('position-title').textContent=title;$('position-title').hidden=!title;
    const reviewed=R?.match(localPosition(frame));
    const playedReview=!frame.freeMove&&node?.move&&cursor>0?R?.choice(localPosition(history[cursor-1]),node.move):null;
    $('candidate-order-note').textContent=reviewed?.review.note?reviewText(reviewed.review.note,reviewed):reviewed?.review.done?'本段定式已完成。以下为后续可选变化，不必立刻续下。':reviewed?'按已核对来源的建议顺序展示；来源建议可以并列，列表编号不代表绝对强弱。':'数字仅作候选编号；此处尚无经核实的相对优劣排序。';
    $('candidate-order-note').classList.toggle('reviewed',!!reviewed);
    if(frame.detached)$('candidate-order-note').textContent+=' 已保留角上的棋形，按当前行棋方继续推荐；外部配置和征子仍需结合全盘判断。';
    if(candidates.length>pointCount)$('candidate-order-note').textContent+=' 同点的不同条件变化共用编号；脱先单独列出，不占棋盘编号。';
    const inherited=(frame.nodeId??frame.studyNodeId)==null?[]:ancestry(frame.nodeId??frame.studyNodeId);
    const badAncestor=[...inherited].reverse().find(n=>n.quality==='bad');
    const conditional=inherited.some(n=>/ladder|征子|条件|requires|only if|provided/i.test(n.comment||'')||n.conditional || n.condition)||history.slice(1,cursor+1).some((frame,index)=>frame.position.lastMove&&R?.choice(localPosition(history[index]),frame.position.lastMove)?.conditional);
    $('position-description').textContent=frame.free?'这个落点暂无对应棋谱。可继续摆棋，或回退到上一个已收录局面。':badAncestor?'正在研究错着后的应对。沿后续分支查看原谱如何利用这一步。':p.moveNumber===0?'选择一个角部起点，把定式、分歧与应对放在同一个棋盘上。':`${fmt(pointCount)} 个后续选点${groupedChoices.has('pass')?'，另有脱先记录':''}。悬停查看一条已收录的后续分支。`;
    $('candidate-count').textContent=pointCount;
    $('candidate-list').innerHTML=[...groupedChoices.values()].flatMap(group=>group.map(({candidate,index},variant)=>{
      const colors=candidateColors(candidate),variantLabel=group.length>1?`同点变化 ${variant+1}/${group.length}`:'';
      return `<div class="candidate-row quality-${candidate.quality}${candidate.review?.legacy?' quality-legacy':''}" data-candidate="${index}"><button class="candidate-play" data-play="${index}" aria-label="落子 ${colorText(candidate.move.color)} ${pointText(candidate.move)}，${escape(entryLabel(candidate))}${variantLabel?'，'+variantLabel:''}"><span class="candidate-number" style="background:${colors[0]};color:${colors[2]}">${candidate.number??'↗'}</span><span class="candidate-label"><strong>${candidate.move.color==='B'?'黑':'白'} ${pointText(candidate.move)}</strong><span class="candidate-details"><small title="${escape(entryLabel(candidate))}">${escape(entryLabel(candidate))}</small>${variantLabel?`<small class="candidate-variant">${variantLabel}</small>`:''}</span></span></button><button class="preview-button" data-preview="${index}" aria-label="预览${candidate.move.pass?'脱先':'候选 '+candidate.number}${variantLabel?'，'+variantLabel:''}">预览 ↗</button></div>`;
    })).join('');
    $('no-candidates').hidden=candidates.length>0;
    $('no-candidates').textContent=frame.free?'未收录不代表错误。回退一手即可回到之前的定式分支。':!$('show-bad').checked&&candidateGroups(frame).length?'此处只有已隐藏的错着分支。勾选“显示错着”继续研究。':edges(frame.refs).some(entry=>nodes[entry.nodeId].move.color!==p.toPlay)?'当前方暂无局部续着。可以在棋盘其他位置落子，随后继续查看另一方的局部应法。':'这条已收录变化到此结束。可以回退探索其他分支，或继续自由落子。';
    const currentQuality=playedReview?.conditional?'questionable':({IDEAL:'good',GOOD:'questionable',QUESTION:'questionable',TRICK:'questionable',MISTAKE:'bad'}[playedReview?.next?.category]||node?.quality);
    $('note-quality').textContent=!frame.freeMove&&node?.move?(playedReview?.primary?'首选参考':qualityText[currentQuality]):'';
    let note=node?.curated&&node.comment?node.comment:currentQuality==='bad'?'核对来源明确将这一手标为错误。后续绿色选点展示该局面下收录的应对；可右键一次走完，再滚轮逐手复盘。':currentQuality==='questionable'?'原谱将此手列为条件变化、疑问手或引擎规避手。请结合原始标注和周围配置判断。':frame.free?'当前处于自由摆棋模式，没有数据库评价。':node?.move?.pass?'原棋谱在此记为停一手 / 脱先。远处落点未给出，不在棋盘上虚构棋子。':p.moveNumber?'候选来自当前棋谱的真实子分支。绿色表示该来源采用的应法，并非实时胜率或全盘最优判断。':'从星位、小目、三三、目外或高目开始；也可以从定式库直接进入名型或错着局面。';
    if(node?.setup?.length||frame.actions.some(id=>nodes[id]?.setup?.length))note+='\n此变化包含原谱配子，已按记录摆入。';
    if(reviewed?.review.note)note=reviewText(reviewed.review.note,reviewed);
    else if(reviewed?.review.done)note='这段定式到此告一段落。可以转向全盘；下方仍保留该局面的后续研究。';
    else if(playedReview?.note)note=reviewText(playedReview.note.note,playedReview);
    if(frame.freeMove&&frame.detached)note=`${colorText(frame.freeMove.color)}已在 ${pointText(frame.freeMove)} 落子，角上棋形保留。现在由${colorText(p.toPlay)}继续。\n`+note;
    $('move-note').textContent=note;
    const relevantReview=reviewed||playedReview;
    const reviewSources=relevantReview?R.sources.filter(source=>relevantReview.review.sourceIds?.includes(source.id)||(relevantReview.review.upstreamSourceId===127&&source.id==='michael-redmond')).filter(source=>source.url):[];
    $('review-links').hidden=!reviewSources.length;
    $('review-links').innerHTML=[...new Map(reviewSources.map(source=>[source.url,source])).values()].map(source=>`<a href="${escape(safeURL(source.url))}" target="_blank" rel="noopener noreferrer">${escape(source.title)} ↗</a>`).join('');
    const rawComment=node?.rawComment||node?.comment||'';
    $('original-note').hidden=!rawComment||node?.curated;
    $('original-note-text').textContent=rawComment;
    $('condition-note').hidden=!(conditional||playedReview?.conditional);
    $('condition-note').textContent='此变化包含征子或配置条件；局部棋谱不能替代全盘判断。'+(inherited.find(n=>n.condition)?.condition ? '\n原谱条件：'+inherited.find(n=>n.condition).condition : '');
    const source=sourceMap.get(node?.sourceId);
    $('source-link').textContent=source?source.name+' ↗':'Pachi / GNU Go / OGS · 多源定式树';
    if(source?.url)$('source-link').href=node?.externalId?'https://online-go.com/joseki/'+encodeURIComponent(node.externalId):safeURL(source.url);else $('source-link').removeAttribute('href');
    document.querySelectorAll('[data-preset]').forEach(button=>button.classList.toggle('active',button.dataset.preset===activePreset));
    $('screen-reader-status').textContent=`第 ${p.moveNumber} 手，${p.toPlay==='B'?'黑':'白'}棋行棋，${candidates.length} 个选点`;
  }
  function buildPreview(candidate, choice=0) {
    const start=candidate.entries[choice]; let position=current().position,local=localPosition(current()),entry=start,line=[],hasSetup=false,passes=0,error='',finished=false,needsChoice=false,needsTurn=false;
    while(entry&&line.length<100){
      const result=applyEntry(position,entry);if(!result.ok){error=result.message;break;}
      hasSetup ||= entry.actions.some(id=>nodes[id].setup?.length);
      if(nodes[entry.nodeId].move?.pass)passes++;
      const localResult=applyEntry(local,entry);
      line.push(entry);position=result.position;
      if(!localResult.ok){error='局部棋形已变化，预览到此。';break;}
      local=localResult.position;
      // A completed joseki can still have later continuations. Do not append them to its result diagram.
      if(R?.match(local)?.review.done){finished=true;break;}
      const next=candidateGroups({position,localPosition:local,refs:[entry.nodeId]}).filter(c=>c.quality!=='bad');
      if(!next.length){needsTurn=edges([entry.nodeId]).some(other=>nodes[other.nodeId].move.color!==position.toPlay);if(!needsTurn&&edges([entry.nodeId]).length)error='后续仅含错着或当前无法合法接续的分支，预览到此。';break;}
      const recommended=R.continuation(next,position.toPlay);
      if(!recommended||recommended.move.pass){needsChoice=true;needsTurn=!!recommended?.move.pass;break;}
      entry=recommended.entries[0];
    }
    return {candidate,choice,line,position,hasSetup,passes,error,finished,needsChoice,needsTurn,origin:cursor,originFrame:current()};
  }
  function previewDescription(preview) {
    const root=rootOf(preview.line[0]?.nodeId);
    // A chosen named-study entry identifies its intended result, unlike an arbitrary future branch.
    if(root?.item?.famous){let last=root;while(last.children.length)last=nodes[last.children[0]];const named=describeNode(last.id);if(named.kind==='joseki')return named;}
    // A preview may reach a named family after its first move. Only inspect
    // the line actually displayed, never a future branch outside the preview.
    for(let index=preview.line.length-1;index>=0;index--){
      const named=describeNode(preview.line[index].nodeId);if(named.kind==='joseki')return named;
    }
    return describeNode(preview.line[0]?.nodeId);
  }
  function showPreview(index,anchor,pin=false,choice=0) {
    const candidate=candidates[index];if(!candidate)return;
    currentPreview=buildPreview(candidate,choice);previewPinned=pin;
    const preview=currentPreview;
    preview.anchor=anchor;
    $('variation-preview').hidden=false;
    $('variation-preview').inert=!pin;
    $('variation-preview').classList.toggle('pinned-preview',pin);
    $('variation-preview').classList.toggle('touch-preview',pin&&matchMedia('(max-width:780px)').matches);
    if(pin&&matchMedia('(max-width:780px)').matches){$('variation-preview').style.maxHeight='90dvh';$('variation-preview').style.overflowY='auto';}
    $('preview-quality').textContent=candidateAssessment(candidate);
    $('preview-quality').style.background=candidateColors(candidate)[0];$('preview-quality').style.color=candidateColors(candidate)[2];
    $('preview-length').textContent=`后续 ${preview.line.length} 手${preview.passes?' · 含脱先':''}`;
    const description=previewDescription(preview),title=description.title;$('preview-title').textContent=title;$('preview-title').hidden=!title;
    const source=sourceMap.get(nodes[candidate.entries[choice].nodeId].sourceId);
    const moveName=describeNode(candidate.entries[choice].nodeId).moveName;
    $('preview-caption').textContent=`${colorText(candidate.move.color)} ${pointText(candidate.move)}${moveName?' · '+moveName:''} · ${source?.name||'本地棋谱'}${candidate.quality==='bad'?' · 错着后的应对':''}`;
    $('preview-board').innerHTML=svgBoard(preview.position,{preview:true,offset:current().position.moveNumber});
    $('preview-note').textContent=[current().detached?'已按实际脱先后的局部棋形接续，远处棋子保留。':null,reviewText(candidate.review?.note?.note,candidate.review),preview.needsTurn?`接下来请由${colorText(preview.position.toPlay)}在棋盘上选择脱先落点，预览到此。`:preview.needsChoice?'已到需要选择的分叉；缺少唯一的来源优先应法，预览到此。':preview.finished?'已到来源标记的定式完成处；暂不追加后续。':preview.error||(preview.hasSetup?'此分支附有原谱配子条件；预览与执行均包含这些配子。':'显示一条已收录支线，不代表唯一最佳后续。')].filter(Boolean).join(' ');
    let refs=$('preview-sources');if(!refs){refs=document.createElement('p');refs.id='preview-sources';refs.className='preview-sources';$('preview-note').after(refs);}
    const links=[...(candidate.review?[{title:'排序与条件依据',url:candidate.review.review.url}]:[]),...(!candidate.review||description.kind==='joseki'?description.sourceIds.map(id=>K.sources.find(source=>source.id===id)).filter(Boolean).slice(0,1):[])];
    refs.hidden=!links.length;refs.innerHTML=links.map(link=>`<a href="${escape(safeURL(link.url))}" target="_blank" rel="noopener noreferrer">${escape(link.title)} ↗</a>`).join(' · ');
    let select=$('preview-branch');
    if(!select){select=document.createElement('select');select.id='preview-branch';select.className='preview-select';select.setAttribute('aria-label','选择预览来源或分支');$('preview-board').before(select);select.addEventListener('change',()=>showPreview(candidates.indexOf(currentPreview.candidate),currentPreview.anchor,true,Number(select.value)));}
    select.hidden=candidate.entries.length<2;
    select.innerHTML=candidate.entries.map((entry,i)=>`<option value="${i}">${escape(sourceMap.get(nodes[entry.nodeId].sourceId)?.name||'棋谱')} · ${escape(qualityText[nodes[entry.nodeId].quality])} · 分支 ${i+1}</option>`).join('');select.value=choice;
    let apply=$('preview-apply');if(!apply){apply=document.createElement('button');apply.id='preview-apply';apply.className='button primary apply-inside';apply.textContent='落下这段变化';$('variation-preview').append(apply);apply.addEventListener('click',applyPreview);}
    apply.textContent='落下这段变化';
    document.querySelectorAll('.candidate-row.selected,.candidate-mark.selected').forEach(el=>el.classList.remove('selected'));
    document.querySelectorAll(`[data-candidate="${index}"]`).forEach(el=>el.classList.add('selected'));
    placePreview(anchor);
  }
  function placePreview(anchor) {
    const box=$('variation-preview');if(box.classList.contains('touch-preview'))return;
    box.style.maxHeight='calc(100dvh - 24px)';box.style.overflowY='auto';
    const rect=anchor?.getBoundingClientRect?anchor.getBoundingClientRect():{left:innerWidth/2,right:innerWidth/2,top:innerHeight/3,bottom:innerHeight/3};
    const width=box.offsetWidth;let left=rect.right+18,top;
    if(left+width<=innerWidth-12)top=Math.max(12,rect.top-60);
    else if(rect.left-width-18>=12){left=rect.left-width-18;top=Math.max(12,rect.top-60);}
    else {
      // A narrow viewport needs a vertical popup so hovering never blocks the click target.
      left=Math.max(12,Math.min(innerWidth-width-12,(rect.left+rect.right-width)/2));
      const above=rect.top-24,below=innerHeight-rect.bottom-24;
      box.style.maxHeight=Math.max(100,Math.max(above,below))+'px';
      top=below>=above?rect.bottom+12:rect.top-box.offsetHeight-12;
    }
    box.style.left=Math.max(12,Math.min(innerWidth-width-12,left))+'px';
    box.style.top=Math.max(12,Math.min(innerHeight-box.offsetHeight-12,top))+'px';
  }
  function hidePreview(force=false) { if(previewPinned&&!force)return;$('variation-preview').hidden=true;currentPreview=null;previewPinned=false;document.querySelectorAll('.selected').forEach(el=>el.classList.remove('selected')); }
  function applyPreview() {
    const preview=currentPreview;if(!preview||preview.originFrame!==current())return;
    if(!preview.line.length){toast('当前分支没有可执行的后续。');return;}
    let count=0;for(const entry of preview.line){
      // Execute the selected line exactly, while retaining other source paths to the same state.
      const matching=candidateGroups(current()).find(candidate=>candidate.entries.some(other=>other.nodeId===entry.nodeId));
      const refs=matching?matching.entries.map(other=>other.nodeId):[entry.nodeId];
      if(!pushEntry(entry,refs,false))break;count++;
    }
    hidePreview(true);render();toast(`已落下预览中的 ${count} 手，可用滚轮逐手回退。`);
  }
  function toast(message) { clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),3000); }
  function openDialog(id) { resetWheelGesture();hidePreview(true);$(id).showModal(); }
  function setPreset(name) {
    if(name==='empty'){reset();return;}
    const points={'星位':[15,3],'小目':[16,3],'三三':[16,2],'目外':[14,2],'高目':[14,3]};
    const point=points[name];reset();activePreset=name;
    const candidate=candidates.find(item=>item.move.x===point[0]&&item.move.y===point[1]&&item.move.color==='B');
    if(candidate)playCandidate(candidate);else render();
  }
  function makeLibrary() {
    libraryEntries=db.collections.map(collection=>({id:collection.root,title:collection.title==='OGS 定式总库'?'全部起点':collection.title.split(' · ')[0],subtitle:'来源目录 · '+(sourceMap.get(collection.sourceId)?.name||''),type:'collection',source:sourceMap.get(collection.sourceId)?.name||''}));
    for(const id of curatedRoots){
      const root=nodes[id],item=root.item,name=item.title.split(' · ')[0];
      for(const reference of item.treeSources||[]){
        const start=nodes.find(node=>node.sourceId===reference.sourceId&&(reference.externalId!=null?Number(node.externalId)===reference.externalId:node.sourceFile===reference.sourceFile&&node.sourceNode===reference.sourceNode));
        if(!start||nodeTitle(start.id)!==name)continue;
        let leaves=0,badWithFollowups=0;const pending=[start.id],seen=new Set();
        while(pending.length){
          const node=nodes[pending.pop()];if(!node||node.invalid||seen.has(node.id))continue;seen.add(node.id);
          const children=node.children.filter(child=>!nodes[child].invalid);
          if(!children.length)leaves++;
          if(node.quality==='bad'&&children.length)badWithFollowups++;
          pending.push(...children);
        }
        const source=sourceMap.get(start.sourceId)?.name||'';
        libraryEntries.push({id:start.id,title:name+' · 原库分支',subtitle:`${source} · ${leaves} 条原谱叶变化 · ${badWithFollowups?'含错着后续':'尚未收录错着惩罚'}`,type:'named-tree',named:true,source,keywords:item.aliases||''});
      }
      libraryEntries.push({id,title:item.title,subtitle:(item.famous?`代表手顺 · ${parseMoves(item.moves).length} 手 · `:'')+item.summary,type:'curated',named:!!item.famous,source:sourceMap.get(root.sourceId)?.name||'',keywords:item.aliases||''});
    }
    for(const node of nodes){
      if(node.quality!=='bad')continue;
      const path=ancestry(node.id),root=path[0],sequence=path.filter(n=>n.move).map(n=>n.move.pass?'脱先':E.coordinates(n.move)).join(' ');
      libraryEntries.push({id:node.id,title:`${nodeTitle(node.id)||'局部研究'} · 第 ${path.filter(n=>n.move).length} 手错着`,subtitle:`${node.move?.color==='B'?'黑':'白'} ${E.coordinates(node.move)||'脱先'} · ${node.children.length?'含后续应对':'原谱未给后续'} · ${node.comment||node.qualityEvidence}`,type:'bad',source:sourceMap.get(node.sourceId)?.name||'',keywords:sequence});
    }
    renderLibrary();
  }
  function renderLibrary() {
    const search=$('library-search').value.toLocaleLowerCase().trim();
    const entries=libraryEntries.filter(entry=>(libraryFilter==='all'||libraryFilter==='named'&&entry.named||libraryFilter===entry.type)&&(!search||`${entry.title} ${entry.subtitle} ${entry.source} ${entry.keywords||''}`.toLocaleLowerCase().includes(search)));
    $('library-results').innerHTML=entries.length?entries.map(entry=>`<button class="library-entry" data-node="${entry.id}" data-before="${entry.type==='bad'}"><span class="entry-icon">${entry.type==='bad'?'误':entry.named?'名':entry.type==='curated'?'选':'谱'}</span><span><strong>${escape(entry.title)}</strong><small>${escape(entry.subtitle)}</small></span><span class="entry-arrow">↗</span></button>`).join(''):'<p class="empty-note">没有找到匹配条目。试试“星位”“大斜”或“Pachi”。</p>';
    $('library-result-count').textContent=`${entries.length} 个入口 · 原库按分支展开，精选为代表手顺；错着入口停在错误发生前。`;
  }
  function sourceDetails() {
    const stats=db.stats;
    $('library-count').textContent=fmt(stats.leaves);
    $('library-intro').textContent=`${fmt(stats.leaves)} 条叶变化，${fmt(stats.bad)} 处原谱明确错着（${fmt(stats.badWithFollowups)} 处有后续），另有 ${curatedRoots.length} 条中文精选。叶变化按来源计数，跨库可能重复。`;
    $('source-details').innerHTML=`<p>本地内置 ${fmt(stats.nodes)} 个原谱节点、${fmt(stats.leaves)} 条叶变化，另保留 ${curatedRoots.length} 条中文精选。统计按来源分别计数，重复手顺并未宣称为不同定式。更新日期：${escape(db.builtAt||'2026-10-31')}。</p>${db.sources.map(source=>`<h3><a href="${escape(safeURL(source.url))}" target="_blank" rel="noopener noreferrer">${escape(source.name)} ↗</a></h3><p>${escape(source.description)}<br>${escape(source.qualityPolicy)}<br>许可：${escape(source.license)}</p>`).join('')}<h3>名称与候选顺序</h3><p>手法名称按实际手顺识别，无可靠名称就隐藏。已核对 ${fmt(R.positionCount)} 个局面的来源建议或局部说明，涉及星位、小目、三三占角、目外、高目及五五。默认续下只采用唯一的教学建议、来源明确的第一建议，或唯一非错着续着；有条件的应法不自动选择。缺少唯一依据的分叉停止预览，定式完成处也停止。其余候选只作编号，不冒充强弱排名。<a href="data/NAMING-AND-ORDER.md" target="_blank" rel="noopener noreferrer">命名和次序的核对依据 ↗</a></p><h3>评价与覆盖范围</h3><p>推荐表示对应棋谱采用的应法，未进行实时 AI 分析。已核对处采用当前来源评级，GOOD / TRICK / QUESTION 归入黄色；与旧谱有不同评价时保留分歧提示。原谱错着与后续应对一同保留；同点存在不同来源评价时显示“有分歧”。未收录的任意落点支持自由摆棋，但没有自动惩罚或评价。</p><p>传统库包含脱先、征子和配子条件。相同颜色连续落子表示省略了对方在别处的一手；预览中可能包含标明的配子。错着分支只有原谱已收录的应对，不能保证穷尽所有惩罚。</p><p>Kogo 整库未经再分发授权，未打包；名定式保留先前独立整理的少量代表手顺与来源。中文精选中的“AI 研究”是已发表的静态棋谱，不调用模型。</p><p><a href="data/SOURCES.md" target="_blank" rel="noopener noreferrer">详细来源、版本与构建说明 ↗</a></p>`;
  }
  function encodeState() {
    const initial=history[0];return {v:2,o:orientation,p:activePreset,root:initial.refs.length===1?initial.refs[0]:null,cursor,steps:history.slice(1).map(frame=>frame.freeMove?{m:frame.freeMove}:{n:frame.nodeId,refs:frame.refs,a:frame.actions,s:!!frame.sourceReplay})};
  }
  function restoreState() {
    if(!location.hash.startsWith('#study='))return;
    try{
      const state=JSON.parse(decodeURIComponent(location.hash.slice(7)));if(![1,2].includes(state.v)||!Array.isArray(state.steps)||state.steps.length>2000)throw Error();
      if(Number.isInteger(state.o)&&state.o>=0&&state.o<8)orientation=state.o;
      $('orientation').value=orientation;
      if(state.root!=null&&nodes[state.root])loadNode(state.root);else reset();
      for(const step of state.steps){
        if(step.m){if(step.m.color!==current().position.toPlay||!playFree(step.m,false))throw Error();}
        else if(nodes[step.n]){
          let match=edges(current().refs).find(entry=>entry.nodeId===step.n);
          if(!match&&Array.isArray(step.a)&&step.a.length&&step.a.at(-1)===step.n){
            const valid=step.a.every((id,i)=>nodes[id]&&(i?nodes[id].parent===step.a[i-1]:current().refs.includes(nodes[id].parent)))&&step.a.filter(id=>nodes[id].move).length===1;
            if(valid)match={nodeId:step.n,actions:step.a};
          }
          if(!match)throw Error();if(!pushEntry(match,(step.refs||[step.n]).filter(id=>nodes[id]),false,state.v===1||step.s===true))throw Error();
        }else throw Error();
      }
      cursor=Math.min(history.length-1,Math.max(0,Number(state.cursor)||0));activePreset=state.p||'';render();
    }catch{reset();toast('局面链接无法完整读取，已回到起点。');}
  }
  function sgfEscape(text) {return String(text).replace(/\\/g,'\\\\').replace(/\]/g,'\\]');}
  function downloadSGF() {
    const sgfPoint=move=>{const p=displayPoint(move);return move.pass?'':String.fromCharCode(97+p.x,97+p.y);};
    let text='(;GM[1]FF[4]CA[UTF-8]SZ[19]AP[Fangcun:2]GN['+sgfEscape($('position-title').textContent||'围棋研究')+']C[有来源的定式研究；颜色标注不是实时 AI 评价。]';
    const initial=history[0].position;text+='PL['+initial.toPlay+']';
    for(const color of ['B','W']){const points=initial.board.flatMap((value,i)=>value===color?[sgfPoint({x:i%19,y:Math.floor(i/19)})]:[]);if(points.length)text+='A'+color+points.map(p=>'['+p+']').join('');}
    for(const frame of history.slice(1,cursor+1)){
      if(frame.freeMove)text+=';'+frame.freeMove.color+'['+sgfPoint(frame.freeMove)+']C['+(frame.detached?'远处实际落子，保留局部定式进度':'自由研究，未收录')+']';
      else for(const id of frame.actions){const node=nodes[id];text+=';';for(const color of ['B','W','E']){const points=(frame.appliedSetup?.[id]??node.setup??[]).filter(point=>point.color===color);if(points.length)text+='A'+color+points.map(point=>'['+sgfPoint(point)+']').join('');}if(node.move)text+=node.move.color+'['+sgfPoint(node.move)+']';const source=sourceMap.get(node.sourceId);text+='C['+sgfEscape([node.comment,qualityText[node.quality],source?.name,source?.url].filter(Boolean).join('\n'))+']';}
    }
    text+=')';const url=URL.createObjectURL(new Blob([text],{type:'application/x-go-sgf;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fangcun-joseki.sgf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  // Event delegation keeps the SVG inexpensive when walking the tree.
  $('main-board').addEventListener('click',event=>{
    const marker=event.target.closest('[data-candidate]');if(marker){playBoardCandidate(candidates[Number(marker.dataset.candidate)]);return;}
    const cell=event.target.closest('[data-x]');if(cell){const point=E.inverseTransformPoint({x:Number(cell.dataset.x),y:Number(cell.dataset.y)},orientation);playFree(point);}
  });
  $('main-board').addEventListener('pointerover',event=>{const marker=event.target.closest('[data-candidate]');if(marker&&event.pointerType!=='touch'&&!marker.contains(event.relatedTarget))showPreview(Number(marker.dataset.candidate),marker);});
  $('main-board').addEventListener('pointerout',event=>{const marker=event.target.closest('[data-candidate]');if(marker&&!marker.contains(event.relatedTarget))hidePreview();});
  $('main-board').addEventListener('focusin',event=>{const marker=event.target.closest('[data-candidate]');if(marker)showPreview(Number(marker.dataset.candidate),marker);});
  $('main-board').addEventListener('focusout',event=>{const marker=event.target.closest('[data-candidate]');if(marker&&!marker.contains(event.relatedTarget))hidePreview();});
  $('main-board').addEventListener('keydown',event=>{const marker=event.target.closest('[data-candidate]');if(marker&&(event.key==='Enter'||event.key===' ')){event.preventDefault();playBoardCandidate(candidates[Number(marker.dataset.candidate)]);}});
  function candidateContextMenu(event) {
    event.preventDefault();const marker=event.target.closest('[data-candidate]');if(!marker)return;
    const index=Number(marker.dataset.candidate);
    if(currentPreview?.candidate!==candidates[index])showPreview(index,marker);
    applyPreview();
  }
  $('main-board').addEventListener('contextmenu',candidateContextMenu);
  $('candidate-list').addEventListener('click',event=>{const play=event.target.closest('[data-play]');if(play){playCandidate(candidates[Number(play.dataset.play)]);return;}const preview=event.target.closest('[data-preview]');if(preview)showPreview(Number(preview.dataset.preview),preview,true);});
  $('candidate-list').addEventListener('pointerover',event=>{const row=event.target.closest('[data-candidate]');if(row&&event.pointerType!=='touch'&&!row.contains(event.relatedTarget))showPreview(Number(row.dataset.candidate),row);});
  $('candidate-list').addEventListener('pointerout',event=>{const row=event.target.closest('[data-candidate]');if(row&&!row.contains(event.relatedTarget))hidePreview();});
  $('candidate-list').addEventListener('contextmenu',candidateContextMenu);
  $('variation-preview').addEventListener('contextmenu',event=>{event.preventDefault();applyPreview();});$('preview-close').addEventListener('click',()=>hidePreview(true));$('apply-preview').addEventListener('click',applyPreview);
  function resetWheelGesture() {
    if(wheelFrame!==null)cancelAnimationFrame(wheelFrame);
    wheelFrame=null;wheelAmount=0;lastWheelTime=0;
  }
  function flushWheel() {
    wheelFrame=null;
    processingWheel=true;
    try {
      let steps=Math.trunc(wheelAmount/wheelStep);
      wheelAmount-=steps*wheelStep;
      // Replaying existing history needs only one render, even for a long swipe.
      if(steps<0){
        if(cursor>0)goTo(cursor+steps);
        if(cursor===0)wheelAmount=0;
      }else if(steps>0){
        const replay=Math.min(steps,history.length-1-cursor);
        if(replay){goTo(cursor+replay);steps-=replay;}
        // Keep new source moves responsive; never walk through an undecided fork.
        const started=performance.now();
        while(steps>0){
          const before=cursor;
          advance();
          if(cursor===before){wheelAmount=0;break;}
          steps--;
          if(performance.now()-started>=8){wheelAmount+=steps*wheelStep;break;}
        }
      }
    }finally{processingWheel=false;}
    if(Math.abs(wheelAmount)>=wheelStep)wheelFrame=requestAnimationFrame(flushWheel);
  }
  $('board-frame').addEventListener('wheel',event=>{
    if(event.ctrlKey||event.deltaY===0||Math.abs(event.deltaY)<Math.abs(event.deltaX))return;
    event.preventDefault();
    const now=performance.now();
    const amount=event.deltaY*(event.deltaMode===1?wheelStep/3:event.deltaMode===2?500:1);
    if(now-lastWheelTime>wheelIdleTime||Math.sign(amount)!==Math.sign(wheelAmount))wheelAmount=0;
    wheelAmount+=amount;lastWheelTime=now;
    if(wheelFrame===null&&Math.abs(wheelAmount)>=wheelStep)wheelFrame=requestAnimationFrame(flushWheel);
  },{passive:false});
  $('previous').onclick=()=>goTo(cursor-1);$('next').onclick=advance;$('first').onclick=()=>goTo(0);$('last').onclick=()=>goTo(history.length-1);$('reset').onclick=()=>reset();
  $('timeline').oninput=event=>goTo(Number(event.target.value));$('show-numbers').onchange=()=>{hidePreview(true);render();};$('show-bad').onchange=()=>{hidePreview(true);render();};
  $('orientation').onchange=event=>{orientation=Number(event.target.value);hidePreview(true);render();};
  document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>setPreset(button.dataset.preset));
  $('library-toggle').onclick=()=>openDialog('library-dialog');$('help-toggle').onclick=()=>openDialog('help-dialog');$('sources-toggle').onclick=()=>openDialog('sources-dialog');
  document.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>$(button.dataset.close).close());
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
  document.querySelectorAll('[data-library-filter]').forEach(button=>button.onclick=()=>{libraryFilter=button.dataset.libraryFilter;document.querySelectorAll('[data-library-filter]').forEach(other=>other.classList.toggle('active',other===button));renderLibrary();});
  $('library-search').oninput=renderLibrary;
  $('library-results').onclick=event=>{const entry=event.target.closest('[data-node]');if(!entry)return;loadNode(Number(entry.dataset.node),entry.dataset.before==='true');$('library-dialog').close();};
  $('download-sgf').onclick=downloadSGF;
  $('copy-link').onclick=async()=>{const url=new URL(location.href);url.hash='study='+encodeURIComponent(JSON.stringify(encodeState()));try{await navigator.clipboard.writeText(url.href);toast('已复制局面链接。');}catch{const input=document.createElement('textarea');input.value=url.href;input.style.cssText='position:fixed;left:-10000px';document.body.append(input);input.select();let copied=false;try{copied=document.execCommand('copy');}catch{}input.remove();if(copied)toast('已复制局面链接。');else{location.hash=url.hash;toast('已将局面写入地址栏，可以复制当前网址。');}}};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){hidePreview(true);return;}if(event.target.closest('input,select,textarea,button')||document.querySelector('dialog[open]'))return;if(event.key==='ArrowLeft'){event.preventDefault();goTo(cursor-1);}else if(event.key==='ArrowRight'){event.preventDefault();advance();}else if(event.key==='Home'){event.preventDefault();goTo(0);}else if(event.key==='End'){event.preventDefault();goTo(history.length-1);}});
  window.addEventListener('resize',()=>hidePreview(true));window.addEventListener('hashchange',restoreState);
  sourceDetails();makeLibrary();reset();restoreState();
  if(!originalRoots.length)toast('大定式库未加载；仍可从定式库打开中文精选。');
  // Read-only debug surface for reproducible integration verification.
  window.JosekiExplorer={getState:()=>({cursor,position:current().position,nodeId:current().nodeId,historyLength:history.length,candidates:candidates.map(c=>({number:c.number,move:c.move,quality:c.quality,label:entryLabel(c),assessment:candidateAssessment(c),nodeIds:c.entries.map(e=>e.nodeId)})),preview:currentPreview?{needsChoice:currentPreview.needsChoice,finished:currentPreview.finished,nodeIds:currentPreview.line.map(e=>e.nodeId),position:currentPreview.position}:null}),loadNode};
})();
