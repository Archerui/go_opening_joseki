// AI-era 4-4 studies with independently written Chinese move notes.
// The linked articles explain KataGo-informed choices; each sourceSgf is its exact diagram.
const aiOtherJoseki = [
  {
    id:'ai-star-33-double-hane',corner:'星位',title:'星位点三三双扳',family:'三三侵入',kind:'取舍',era:'AI研究',level:'进阶',
    summary:'黑棋双扳保角，白棋在外侧形成提子棋形并争先手。',
    intro:'从黑星位、白棋直接点三三起步。黑棋选择双扳，着眼保住角地；白棋用外侧棋形和先手作交换。挡的方向须结合邻近棋子决定。',
    setup:'B[pp] W[qq]',
    moves:'B[pq] W[qp] B[qo] W[ro] B[rn] W[qn] B[po] W[rm] B[rp] W[sn] B[rq]',
    source:'https://resigning-in-sente.github.io/joseki/44/2021/02/21/44-33-invasion-2-1-double-hane/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-02-21-sgf/double-hane-sgf/01.sgf',
    sourceLabel:'查看 KataGo 双扳研究 ↗',
    notes:{1:'黑棋先从底边挡。挡哪一边，决定双方外势朝向。',2:'白棋沿右边长，准备继续行棋。',3:'黑棋向外扳住，开始双扳的角上取舍。',4:'白棋向右侧扳，准备转换到外侧。',5:'黑棋再扳，继续守住角内实地。',6:'白棋切断黑棋双扳的两子，准备吃住外侧一子。',7:'黑棋补强底边的连接。',8:'白棋往外侧继续整理形状。',9:'黑棋在二路紧气，试图收紧白棋。',10:'白棋在边上回头，保留外侧提子的形状。',11:'黑棋完成角部防守；白棋在外侧取得先手潜力。'},
    takeaways:['双扳让黑棋保角，白棋通常获得外侧棋形和先手。','方向选择要看外势面向哪一边，不能只看角里的目数。']
  },
  {
    id:'ai-star-33-knight',corner:'星位',title:'星位点三三小飞',family:'三三侵入',kind:'安定',era:'AI研究',level:'入门',
    summary:'黑棋从外侧长，白棋小飞安定角形。',
    intro:'早三三侵入后，黑棋选择沿外侧长出，白棋用小飞向边上借空间。这是作者比较的 AI 时代基本线之一。',
    setup:'B[pp] W[qq]',
    moves:'B[pq] W[qp] B[po] W[rn]',
    source:'https://resigning-in-sente.github.io/joseki/44/2021/07/21/44-33-invasion-3-knight-vs-push/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-02-21-sgf/intro-sgf/04.sgf',
    sourceLabel:'查看三三小飞与推的比较 ↗',
    notes:{1:'黑棋从底边挡，选择外侧发展方向。',2:'白棋沿右边长，维持三三棋子的活动。',3:'黑棋沿外侧长，准备取外侧与先手。',4:'白棋小飞，争取角里和右边之间的弹性。'},
    takeaways:['小飞是常见的安定方式，角内与外侧仍留有后续。','作者认为小飞与推的局部差距通常很小；方向比细微评价更重要。']
  },
  {
    id:'ai-star-33-push',corner:'星位',title:'星位点三三推',family:'三三侵入',kind:'安定',era:'AI研究',level:'进阶',
    summary:'白棋先推，黑棋扳住；后续更依赖全盘方向。',
    intro:'与小飞线同样从早三三开始。白棋选择沿边推，争取更多角边空间；黑棋随后扳住。作者提醒这一线的后续时机更敏感。',
    setup:'B[pp] W[qq]',
    moves:'B[pq] W[qp] B[po] W[qo] B[qn] W[rn]',
    source:'https://resigning-in-sente.github.io/joseki/44/2021/07/21/44-33-invasion-3-knight-vs-push/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-02-21-sgf/intro-sgf/05.sgf',
    sourceLabel:'查看三三小飞与推的比较 ↗',
    notes:{1:'黑棋决定从底边挡，外势方向随之确定。',2:'白棋沿右边长，保持三三棋子联络。',3:'黑棋外侧长，争取厚势和先手。',4:'白棋推一手，扩张角边的活动空间。',5:'黑棋扳住白棋的推进，限制白棋继续向外长。',6:'白棋再向右边走，使角内棋形更有弹性。'},
    takeaways:['推与小飞的差别细微，关键在后续先手与外侧配置。','推后局部还留有双方先走的价值，需注意时机。']
  },
  {
    id:'ai-star-direction-outside',corner:'星位',title:'星位三四靠外扳',family:'三四靠角',kind:'方向',era:'AI研究',level:'进阶',
    summary:'白棋从三四靠星位，黑棋外扳后转入双扳形。',
    intro:'白棋用三四点靠角，先选自己希望经营的方向。黑棋外扳可以转成双扳形，但外势朝向已经受到白棋靠点的影响。',
    setup:'B[pp] W[qp]',
    moves:'B[qo] W[qq] B[pq] W[ro] B[rn] W[qn] B[po] W[rm] B[rp] W[sn] B[rq]',
    source:'https://resigning-in-sente.github.io/joseki/44/2021/02/21/44-33-invasion-2-2-34-invasion/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-02-21-sgf/34-sgf/03.sgf',
    sourceLabel:'查看方向选择解说 ↗',
    notes:{1:'黑棋从外侧扳住靠子，试图继续争取右边。',2:'白棋进入三三，换取角内立足点。',3:'黑棋从底边挡，开始形成双扳的结构。',4:'白棋向右侧扳，保留目标方向的活动。',5:'黑棋继续扳，守角同时限制白棋。',6:'白棋切断黑棋双扳的两子，准备吃住外侧一子。',7:'黑棋连接底边，维持角内控制。',8:'白棋向外走，争取右边发展。',9:'黑棋在二路收紧白棋。',10:'白棋继续整理外侧棋形。',11:'黑棋守住角部；双方所得须结合右边布局评价。'},
    takeaways:['三四靠角给侵入方更多方向控制。','转成双扳形后，仍需比较角地、外势和先手。']
  },
  {
    id:'ai-star-direction-inside',corner:'星位',title:'星位三四靠内扳',family:'三四靠角',kind:'方向',era:'AI研究',level:'进阶',
    summary:'黑棋内扳保角，白棋沿右边安定。',
    intro:'同一三四靠起点，黑棋改从角内应。白棋沿右边建立棋形，黑棋保持较大的角；这种取舍由全盘方向决定。',
    setup:'B[pp] W[qp]',
    moves:'B[qq] W[qo] B[rq] W[on] B[op] W[qm]',
    source:'https://resigning-in-sente.github.io/joseki/44/2021/02/21/44-33-invasion-2-2-34-invasion/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-02-21-sgf/34-sgf/04.sgf',
    sourceLabel:'查看方向选择解说 ↗',
    notes:{1:'黑棋内扳，优先把角地守住。',2:'白棋向右边长，不在角内硬争。',3:'黑棋在二路补角，角地逐渐成形。',4:'白棋向外侧展开，把靠角子变成右边的根据。',5:'黑棋从底边补强连接。',6:'白棋继续在右边延伸，局部转为角地与边上棋形的交换。'},
    takeaways:['内扳让黑棋保留角地，白棋获取边上发展。','三四靠是否合适，要看白棋是否真正需要这一方向。']
  },
  {
    id:'ai-star-low-slide',corner:'星位',title:'星位低挂滑角',family:'低挂',kind:'比较',era:'AI研究',level:'入门',
    summary:'白棋低挂后滑角，黑棋可守角；是否应手看周围支持。',
    intro:'低挂星位遇黑棋低位应法后，白棋选择滑入角下。研究指出，早期全盘中黑棋有时可脱先；若附近已有黑棋支援，滑角也可能更符合白棋的方向。',
    setup:'B[pp] B[qn] W[nq]',
    moves:'W[pr] B[qq] W[kq]',
    source:'https://resigning-in-sente.github.io/joseki/44/2021/02/18/44-low-slide-attach/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-02-18-sgf/slide-attach-sgf/02.sgf',
    sourceLabel:'查看滑角与靠角比较 ↗',
    notes:{1:'白棋滑到二路，争取角下根据，但并不一定迫使黑棋立即应。',2:'黑棋补三三，优先固定角地。',3:'白棋沿底边拆开，形成较宽的安定空间。'},
    takeaways:['滑角的好处是挂角子更容易保持联系。','黑棋是否马上守角，取决于全盘更大的着点。']
  },
  {
    id:'ai-star-low-attach',corner:'星位',title:'星位低挂靠角',family:'低挂',kind:'比较',era:'AI研究',level:'进阶',
    summary:'白棋改用靠角，要求黑棋立即作出局部选择。',
    intro:'同样的低挂局面，白棋选择靠在星位下方。研究认为它在早期常比滑角更主动，但角外的强弱和底边归属仍会改变判断。',
    setup:'B[pp] B[qn] W[nq]',
    moves:'W[pq] B[qq] W[qr] B[oq] W[pr]',
    source:'https://resigning-in-sente.github.io/joseki/44/2021/02/18/44-low-slide-attach/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-02-18-sgf/slide-attach-sgf/03.sgf',
    sourceLabel:'查看滑角与靠角比较 ↗',
    notes:{1:'白棋靠在黑星位下方，直接制造接触，要求黑棋选应法。',2:'黑棋扳住角内，先照顾实地。',3:'白棋沿二路扳，寻找角下空间。',4:'黑棋从左侧压，避免白棋轻易占据底边。',5:'白棋连接角下棋子，局部仍需结合周围强弱继续判断。'},
    takeaways:['靠角比滑角更容易迫使对方回答，但也引入接触战。','如果黑棋在旁边已有援军，白棋不能机械照搬这条线。']
  }
];
