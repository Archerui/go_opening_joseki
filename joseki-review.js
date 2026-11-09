/* Offline source assessments. A source's first suggestion is not a win-rate estimate. */
(function (root, factory) {
  const make = factory();
  if(typeof module === 'object' && module.exports) module.exports = make;
  else root.JosekiReview = make(root.GoEngine, root.REVIEWED_SANSAN, root.REVIEWED_LIBRARY, root.MANUAL_ORDER_NOTES);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  return function createReview(engine, ...datasets) {
    const index = new Map(), positions = new Map(), sources = new Map();
    const key = position => position.board.map(stone=>stone||'.').join('')+position.toPlay;
    const parse = placement => placement === 'pass' ? {x:-1,y:-1,pass:true} : engine.parseCoordinates(placement);
    for(const data of datasets.filter(Boolean)) {
      for(const source of data.sources||[])sources.set(source.id,source);
      for(const review of data.positions||[]) {
        const signature=review.moves.join('.'),previous=positions.get(signature)||{nextMoves:[]};
        positions.set(signature,{...previous,...review,candidateNotes:{...previous.candidateNotes,...review.candidateNotes}});
      }
    }
    for(const review of positions.values()) {
      let original=engine.createPosition();
      for(const placement of review.moves){const result=engine.play(original,parse(placement));if(!result.ok)throw new Error('Invalid reviewed sequence '+review.externalId);original=result.position;}
      for(let symmetry=0;symmetry<8;symmetry++)for(const swapped of [false,true]) {
        const board=Array(361).fill(null);
        original.board.forEach((stone,i)=>{if(stone){const point=engine.transformPoint({x:i%19,y:Math.floor(i/19)},symmetry);board[point.y*19+point.x]=swapped?(stone==='B'?'W':'B'):stone;}});
        const toPlay=swapped?(original.toPlay==='B'?'W':'B'):original.toPlay;
        const signature=key({board,toPlay}),matches=index.get(signature)||[];
        // Symmetric corner positions can have more than one valid direction.
        matches.push({review,symmetry,swapped});index.set(signature,matches);
      }
    }
    function match(position) { return (index.get(key(position))||[])[0] || null; }
    function choice(position,move) {
      if(move.color!==position.toPlay)return null;
      for(const found of index.get(key(position))||[]) {
        const canonical=move.pass?'pass':engine.coordinates(engine.inverseTransformPoint(move,found.symmetry));
        const next=found.review.nextMoves.find(child=>child.placement===canonical);
        const note=found.review.candidateNotes?.[canonical];
        if(next||note)return {...found,canonical,next,note,order:next?.sourceOrder ?? Infinity,conditional:!!note?.conditional,primary:!!note?.preferred,legacy:!!note?.legacy};
      }
      return null;
    }
    function continuation(candidates,toPlay) {
      candidates=candidates.filter(candidate=>!candidate.offTurn&&(!toPlay||candidate.move?.color===toPlay));
      const safe=candidates.filter(candidate=>candidate.quality!=='bad'&&candidate.quality!=='questionable'&&!candidate.conditional&&!candidate.review?.conditional);
      if(!safe.length)return null;
      const preferred=safe.filter(candidate=>candidate.review?.primary);
      if(preferred.length===1)return preferred[0];
      const first=safe.filter(candidate=>candidate.review?.next&&candidate.review.order===1);
      if(first.length===1)return first[0];
      // Only a sole recorded response can continue without a comparative source recommendation.
      return candidates.filter(candidate=>candidate.quality!=='bad').length===1&&safe.length===1?safe[0]:null;
    }
    return {match,choice,continuation,sources:[...sources.values()],positionCount:positions.size,reviewedAt:datasets.filter(Boolean).map(data=>data.reviewedAt||'').sort().at(-1)||''};
  };
});
