const SOURCE = 'https://github.com/pasky/pachi/blob/master/joseki/joseki_34.sgf';

// Classical lines follow Pachi's joseki_34.sgf. AI study lines cite their own SGF and commentary sources.
const joseki = [
  {
    id:'low-knight', title:'低挂 · 小飞应', family:'低挂', kind:'守角', level:'入门',
    summary:'以轻快的小飞守住角，白棋随后可滑入角内。',
    intro:'黑棋小飞兼顾角地与右边。白棋选择滑入时，双方围绕角上的归属进行交换。',
    moves:'B[qd] W[oc] B[pf] W[qc] B[rc] W[pd] B[qe] W[qb]',
    notes:{1:'黑棋占据右上小目，先向角地提出主张。',2:'白棋从上边低挂，希望在边上立足。',3:'黑棋小飞应，保留角地，同时照顾右边的发展。',4:'白棋滑入角内，开始争取实地。',8:'这一分支走至白棋在二路落子。回看黑白在角、边的所得。'},
    takeaways:['黑棋先确保角上的形状，再考虑向边上延伸。','白棋滑入后，局部仍需关注先手与后续手段。']
  },
  {
    id:'low-diagonal', title:'低挂 · 尖应', family:'低挂', kind:'应法', level:'入门',
    summary:'以尖应照顾角地，白棋向远处展开。',
    intro:'黑棋选择较稳的尖应，白棋没有立刻接触，而是把棋子展开到上边。',
    moves:'B[qd] W[oc] B[pe] W[lc] B[pc] W[od] B[pg]',
    notes:{2:'白棋从上边低挂小目。',3:'黑棋尖应，重视自身连接和角地。',4:'白棋沿上边展开，争取更宽的空间。',7:'黑棋补在右边，局面从角部过渡到边上的布局。'},
    takeaways:['尖应偏向稳固，白棋可以考虑向外舒展。','观察白棋远处落子与全盘其他棋子的配合。']
  },
  {
    id:'low-one-pincer', title:'低挂 · 一间低夹', family:'低挂', kind:'夹攻', level:'进阶',
    summary:'不直接应角，先夹住白棋的低挂子。',
    intro:'黑棋用一间低夹限制白棋在上边的发展。白棋需要在安定与角上利益之间作选择。',
    moves:'B[qd] W[oc] B[mc] W[oe] B[pf] W[ph] B[of] W[md] B[pc] W[nc] B[mf]',
    notes:{3:'黑棋一间低夹，先向白棋施加压力。',4:'白棋向中央一间跳，寻求出头。',8:'白棋在外侧寻求连接，也留下新的攻防关系。',11:'读到这里，重点比较黑棋角地与白棋外势。'},
    takeaways:['夹攻通常要有附近棋子的支持。','白棋的应对不只关乎角地，还关乎整块棋的安定。']
  },
  {
    id:'low-two-pincer', title:'低挂 · 二间低夹', family:'低挂', kind:'夹攻', level:'进阶',
    summary:'夹得更宽，给白棋留出腾挪的余地。',
    intro:'黑棋在更远的位置夹攻。较宽的距离让双方都有变化空间，也更依赖周围配置。',
    moves:'B[qd] W[oc] B[lc] W[of] B[qg] W[jc] B[le] W[pd] B[qe] W[qc] B[rc] W[qb]',
    notes:{3:'黑棋二间低夹，布局方向开始影响局部选择。',4:'白棋向中央二间跳，暂时保留角上的手段。',6:'白棋在上边展开，夹攻的效果需要结合全局判断。',12:'白棋再次进入角上，形成角地与外势的交换。'},
    takeaways:['二间夹的宽度较大，后续变化更自由。','看黑棋夹攻一侧是否已有支援，再决定是否采用。']
  },
  {
    id:'high-attach-extend', title:'高挂 · 托退', family:'高挂', kind:'接触', level:'入门',
    summary:'黑棋托，白棋扳，双方用接触手段定型。',
    intro:'小目高挂后，黑棋从下方托住白棋。白棋沿边扳出，黑棋退回保护角上的结构。',
    moves:'B[qd] W[od] B[oc] W[nc] B[pc] W[nd] B[qf]',
    notes:{2:'白棋高挂，着眼于向中央发展。',3:'黑棋在白棋下方托，直接接触。',4:'白棋扳出，争取上边的形状。',5:'黑棋退回，照顾角部连接。',7:'黑棋一间跳，保持右边的活动空间。'},
    takeaways:['接触战里，气紧与连接要一起计算。','黑棋取角，白棋取边与外侧的空间。']
  },
  {
    id:'high-knight', title:'高挂 · 小飞应', family:'高挂', kind:'守角', level:'入门',
    summary:'平稳守角，再处理白棋的角上滑入。',
    intro:'黑棋小飞应后，白棋有机会滑入角内。黑棋继续在角上应对，白棋向上边展开。',
    moves:'B[qd] W[od] B[pf] W[qc] B[rc] W[pc] B[re] W[lc]',
    notes:{3:'黑棋小飞应，着重角地。',4:'白棋滑入角内，试探黑棋的应法。',6:'白棋在上边继续行棋，整理自身的形状。',8:'白棋展开到左侧，后续要看全盘方向。'},
    takeaways:['小飞应的步调相对平稳。','白棋进入角部后，黑棋要注意不能被分断。']
  },
  {
    id:'high-jump', title:'高挂 · 一间跳应', family:'高挂', kind:'应法', level:'入门',
    summary:'黑棋向右边一间跳，重视边上的发展。',
    intro:'面对高挂，黑棋不急于接触，而是向右边跳出。白棋随即试探角上的空间。',
    moves:'B[qd] W[od] B[qf] W[qc] B[rc] W[pc] B[rb]',
    notes:{3:'黑棋从小目向右边一间跳，保持较轻的形状。',4:'白棋滑入角上，试探黑棋的防守。',7:'黑棋补强角部，继续保留右边的展开。'},
    takeaways:['一间跳比接触应法更强调向边上的发展。','白棋的角上手段不能只凭局部判断好坏。']
  },
  {
    id:'high-one-pincer', title:'高挂 · 一间低夹', family:'高挂', kind:'夹攻', level:'进阶',
    summary:'用低夹压缩高挂子的上边空间。',
    intro:'黑棋低夹白棋高挂子，白棋转而进入角上。双方形成角地、外势与边上安定的交换。',
    moves:'B[qd] W[od] B[mc] W[qc] B[rc] W[pc] B[qg] W[rb] B[rd] W[ne] B[qj] W[ld] B[kc]',
    notes:{3:'黑棋一间低夹，压缩白棋在上边的发展。',4:'白棋转入角上，改变争夺重点。',7:'黑棋向右边展开，夹攻子与角上棋子开始配合。',13:'局部形状形成后，应回到全局比较厚薄。'},
    takeaways:['高挂遇夹攻时，角上的滑入是一种转换方向。','夹攻子是否有援军，会改变后续攻防价值。']
  },
  {
    id:'high-two-high-pincer', title:'高挂 · 二间高夹', family:'高挂', kind:'夹攻', level:'进阶',
    summary:'把夹攻重心放在外侧，争取厚势。',
    intro:'黑棋以二间高夹限制白棋，随后双方通过接触、扳粘与角上争夺交换利益。',
    moves:'B[qd] W[od] B[ld] W[pg] B[oe] W[ne] B[of] W[pd] B[pe] W[qc] B[qe] W[nc] B[rc] W[qb]',
    notes:{3:'黑棋二间高夹，重心在外侧与中央。',4:'白棋大飞转向右边，避免单纯受夹。',5:'黑棋接触白棋，攻防转为具体的气和连接。',14:'白棋取得角上空间，黑棋在外侧留下影响力。'},
    takeaways:['高夹的价值常取决于中央与边上的配合。','接触以后先看断点和气，再评估外势。']
  },
  {
    id:'high-pressure', title:'高挂 · 靠压', family:'高挂', kind:'接触', level:'进阶',
    summary:'从内侧靠住白棋，把局部引向接触战。',
    intro:'黑棋直接靠住高挂子，双方连续扳长。每一步都关系到连接与角上的归属。',
    moves:'B[qd] W[od] B[oe] W[ne] B[pe] W[md] B[oc] W[nc] B[ob]',
    notes:{3:'黑棋贴着高挂子靠压，要求白棋立即应对。',4:'白棋扳住，保持向外的弹性。',5:'黑棋继续压，双方开始争夺连接。',9:'读到这里，比较双方在角部和外侧的所得。'},
    takeaways:['靠压是强硬的接触手段，需要读清扳断。','周围棋子的位置会影响这条分支是否合适。']
  },
  {
    id:'ai-attach-hane', title:'四四靠扳打', family:'靠角', kind:'接触', era:'AI研究', level:'进阶',
    summary:'小目遭四四靠时，黑扳住角；白选择向想经营的一边扳出。',
    intro:'从黑小目、白四四靠的局面起步。研究重点不是把这手靠当作万能好手，而是比较黑棋局部角地与白棋想要的行棋方向。',
    setup:'B[pq] W[pp]',
    moves:'B[qp] W[oq] B[po] W[op] B[qq]',
    source:'https://resigning-in-sente.github.io/joseki/34/2021/08/03/44-attach/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-08-03-sgf/04.sgf',
    sourceLabel:'查看 KataGo 研究解说 ↗',
    notes:{1:'黑棋扳住靠子，优先确保角上的利益；白棋获得选择行棋方向的机会。',2:'白棋朝希望发展的底边扳出，主动决定后续的方向。',3:'黑棋打吃白棋靠子，要求白棋把自身连接起来。',4:'白棋粘住，保留沿底边展开的形状。',5:'黑棋补角，局部角地较实；白棋已站到想经营的边。此处可以考虑脱先。'},
    takeaways:['四四靠是有方向要求的选择，不能脱离全盘照搬。','此线黑棋局部稍厚实，白棋用行棋方向和先手作交换。']
  },
  {
    id:'ai-attach-extend', title:'四四靠伸角', family:'靠角', kind:'接触', era:'AI研究', level:'进阶',
    summary:'黑棋先向角内伸，白棋沿目标边安定。',
    intro:'同样从小目与四四靠的接触局面出发。黑棋选择先伸角，白棋便把棋子落向自己希望经营的底边。',
    setup:'B[pq] W[pp]',
    moves:'B[qq] W[op] B[ro] W[oq]',
    source:'https://resigning-in-sente.github.io/joseki/34/2021/08/03/44-attach/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-08-03-sgf/05.sgf',
    sourceLabel:'查看 KataGo 研究解说 ↗',
    notes:{1:'黑棋沿角内伸出，先限制白棋在角里的余地。',2:'白棋向底边长，争取在预定方向上站稳。',3:'黑棋沿右边延伸，取得角地与右边的结合。',4:'白棋挡住底边，完成自身方向的选择；黑棋通常可转向全盘。'},
    takeaways:['黑棋守住角部时，白棋可以换取目标方向的外侧棋形。','这条线的价值随周围强弱变化，不能只按角地大小比较。']
  },
  {
    id:'ai-pincer-tenuki-attach', title:'夹攻脱先后靠压', family:'夹攻', kind:'脱先', era:'AI研究', level:'进阶',
    summary:'白棋被夹后先走别处，黑棋靠压时再回角上安定。',
    intro:'起始局面是小目低挂遭一间夹，白棋已在别处下过一手。这个分支研究黑棋靠压后的局部交换；白棋扳起的选点以有利征子为前提。',
    setup:'B[pq] B[qm] W[qo]',
    moves:'B[po] W[pp] B[op] W[qp] B[pn] W[qq] B[or] W[qr]',
    source:'https://resigning-in-sente.github.io/joseki/34/2021/07/09/34-pincer-avoid/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-07-09-sgf/pincer-sgf/05-2.sgf',
    sourceLabel:'查看 KataGo 脱先研究 ↗',
    notes:{1:'白棋先前已脱先，黑棋回头靠压，试着限制白棋的活动。',2:'白棋从角内应对；这条分支需要先确认相关征子对白有利。',3:'黑棋向外压，开始形成厚势。',4:'白棋继续借角上的接触寻找安定。',5:'黑棋补强外侧，争取把白棋封在角内。',6:'白棋进入角里，角地的归属逐渐清晰。',7:'黑棋收紧角外形状，但投入的局部手数也增加了。',8:'白棋在二路继续安定，黑棋得到厚势；别忘了白棋此前已经脱先取得全盘一手。'},
    takeaways:['白棋的这条扳起分支依赖征子，实战先核对征子方向。','局部黑厚白地的交换，要把白棋此前脱先的一手算进去。']
  },
  {
    id:'ai-pincer-base', title:'高夹后弃子拆边', family:'夹攻', kind:'转换', era:'AI研究', level:'进阶',
    summary:'白棋放轻被夹的一子，转到边上建立根据。',
    intro:'黑棋小目与高夹子已经在盘上，白棋挂角子处于夹攻中。白棋不强求每颗棋子连回，而是先在底边打开活动空间。',
    setup:'B[pl] B[pq] W[po]',
    moves:'W[mq] B[op] W[jq] B[oo]',
    source:'https://resigning-in-sente.github.io/joseki/34/2021/07/09/34-pincer-avoid/',
    sourceSgf:'https://resigning-in-sente.github.io/assets/sgf/2021-07-09-sgf/pincer-sgf/07.sgf',
    sourceLabel:'查看 KataGo 夹攻研究 ↗',
    notes:{1:'白棋跳向底边，优先给新棋建立根据，把原先的挂角子放轻。',2:'黑棋分断白棋两处棋子，巩固角上的控制。',3:'白棋继续在底边展开，用边上的安定换取角上的让步。',4:'黑棋补强角部。白棋局部亏地，但可利用底边和被夹一子的余味争取全盘补偿。'},
    takeaways:['主动弃掉被夹的一子，可以把复杂战斗改成方向明确的交换。','黑棋局部多一子，白棋需要靠外侧发展、先手和余味来补偿。']
  },
  {
    id:'ai-high-pincer-side', title:'高夹靠角保边', family:'夹攻', kind:'接触', era:'AI研究', level:'高阶',
    summary:'白棋靠入角下，黑棋守边后被白棋沿底边推出。',
    intro:'这是一盘 AI 研究中的全盘起始局面：右下小目遭挂角与高夹，白棋选择过去常被认为可疑的靠角。此线黑棋优先照顾边上。',
    setup:'B[pq] B[pl] B[qd] B[nc] W[dp] W[dd] W[po]',
    moves:'W[qq] B[qr] W[qp] B[or] W[no] B[pi] W[nq] B[nr] W[lq]',
    source:'https://go-corner.org/2020/04/13/joseki-high-pincer-2/',
    sourceSgf:'https://go-corner.org/2020/04/13/joseki-high-pincer-2/sgf/v-A.sgf',
    sourceLabel:'查看高夹 AI 变化解说 ↗',
    notes:{1:'白棋在角下靠，改变被高夹后只能向外逃的局面。',2:'黑棋应在角下，先整理靠角产生的接触。',3:'白棋沿边行动，争取不被完全封住。',4:'黑棋继续照顾角部连接。',5:'白棋跳出，为底边的后续行动留空间。',6:'黑棋优先补右边，选择保住边上的形状。',7:'白棋从底边推，迫使黑棋在低位应对。',8:'黑棋继续沿二路防守，角地虽稳但位置偏低。',9:'白棋向左展开，得到较宽的底边空间。'},
    takeaways:['白棋靠角是这一研究的关键转向，需结合高夹子的配置。','黑棋保边后，白棋通过连续推进取得底边活动空间。']
  },
  {
    id:'ai-high-pincer-corner', title:'高夹靠角保角', family:'夹攻', kind:'接触', era:'AI研究', level:'高阶',
    summary:'黑棋改守角，白棋从夹攻子下方滑出并取得先手。',
    intro:'与上一条共用靠角起始局面。这次黑棋选择守角，白棋利用右边的空间安定，最后可转往全盘大场。',
    setup:'B[pq] B[pl] B[qd] B[nc] W[dp] W[dd] W[po]',
    moves:'W[qq] B[qr] W[qp] B[or] W[no] B[mp] W[rl] B[ql] W[rm] B[qj] W[fc]',
    source:'https://go-corner.org/2020/04/13/joseki-high-pincer-2/',
    sourceSgf:'https://go-corner.org/2020/04/13/joseki-high-pincer-2/sgf/v-B.sgf',
    sourceLabel:'查看高夹 AI 变化解说 ↗',
    notes:{1:'白棋先靠角，向黑棋提出局部选择。',2:'黑棋应在角下，继续维持角上的连接。',3:'白棋沿边出头，不愿被高夹压在原地。',4:'黑棋继续封角，白棋之后要找外侧出口。',5:'白棋跳出，保留右边活动的可能。',6:'黑棋守住角地，放缓对右边白棋的围堵。',7:'白棋在夹攻子下方滑出，准备于右边安定。',8:'黑棋从内侧跟住，防止白棋轻易取得过多边地。',9:'白棋再下一手，右边棋形逐渐稳定。',10:'黑棋补强外侧，但局部手数也随之增加。',11:'白棋转到左上大场，展示这一分支在全盘中的先手价值。'},
    takeaways:['黑棋守角和保边是两种不同的取舍。','白棋安定后能否脱先，取决于右边是否仍有紧迫的后续。']
  }
];
joseki.push(...expandedJoseki,...aiOtherJoseki,...famousJoseki);


window.CURATED_JOSEKI = joseki;
