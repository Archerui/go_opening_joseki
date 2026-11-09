// The move sequences below are selected branches from GNU Go's corner-pattern SGFs.
// Explanations are original study notes; they are not engine evaluations.
const expandedJoseki = [
  {
    id:'star-33-outside',corner:'星位',title:'星位 · 三三侵入取外势',family:'三三侵入',kind:'取舍',level:'入门',
    summary:'白棋从三三进入，黑棋在外侧筑形。',
    intro:'星位角面对三三侵入时，黑棋先决定挡的方向。这个分支让白棋留在角里，黑棋向上边建立外势。',
    moves:'B[pd] W[qc] B[qd] W[pc] B[oc] W[ob] B[nc] W[nb] B[mc] W[rd] B[re] W[rc] B[qf]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_other.sgf',
    notes:{1:'黑棋先占星位，重视外侧发展。',2:'白棋直接点三三，要求确定角上的归属。',3:'黑棋从一侧挡，先选好外势面向的方向。',4:'白棋沿三路在角内延伸。',5:'黑棋跟着封住角，外侧开始连成一片。',7:'黑棋继续向边上延伸，外势逐渐成形。',9:'黑棋补外侧，避免白棋轻易冲断。',10:'白棋转到右边试探黑棋的封锁。',13:'黑棋在右边补形，白棋得角、黑棋得外侧。'},
    takeaways:['挡的方向要与邻近棋子配合。','外势需要后续发挥，不能把它直接当作实地。']
  },
  {
    id:'star-low-slide',corner:'星位',title:'星位 · 小飞挂一间低夹点三三',family:'低挂',kind:'夹攻',level:'入门',
    summary:'黑棋一间低夹，白棋点三三争取角内根据。',
    intro:'白棋小飞挂星位，黑棋在挂角子的另一侧一间低夹；白棋随后点三三。双方围绕角地与外侧的厚薄继续交换。',
    moves:'B[pd] W[qf] B[qh] W[qc] B[qd] W[pc] B[od] W[rd] B[re] W[rc] B[qe] W[nc] B[pf]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{2:'白棋从右边小飞挂星位。',3:'黑棋在挂角子下方一间低夹，限制白棋沿右边展开。',4:'白棋点三三，开始争取角内根据。',5:'黑棋在三三下方挡，选择外侧方向。',7:'黑棋沿四路长，争取外势。',9:'黑棋在右边挡住，收紧白棋角内空间。',13:'黑棋补强外侧，局部形状暂告一段落。'},
    takeaways:['遇夹攻后，点三三是一种争取角内根据的选择。','黑棋得到的外势是否有用，要看上边配置。']
  },
  {
    id:'star-low-jump',corner:'星位',title:'星位 · 低挂一间跳应',family:'低挂',kind:'应法',level:'入门',
    summary:'黑棋向上边跳，白棋从角内试探。',
    intro:'黑棋不靠近白棋，而是往上边一间跳。白棋从角内试探后，双方分别整理角部与边上的形状。',
    moves:'B[pd] W[qf] B[nd] W[qd] B[qc] W[rc] B[pc] W[re] B[rb] W[sb]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{2:'白棋小飞挂，准备在右边建立立足点。',3:'黑棋向上边一间跳，先扩展外侧。',4:'白棋托住星位，要求黑棋说明守角方式。',5:'黑棋向角内扳，限制白棋的实地。',7:'黑棋继续收紧角部。',10:'白棋在一路落子，把角内形状固定下来。'},
    takeaways:['一间跳应重视上边和中央的潜力。','白棋角内的后续要与右边挂角子一起判断。']
  },
  {
    id:'star-low-press',corner:'星位',title:'星位 · 小飞挂靠压',family:'低挂',kind:'接触',level:'进阶',
    summary:'黑棋靠压挂角子，白扳黑长后整理角边。',
    intro:'面对小飞挂，黑棋从四路靠压。白棋扳出、黑棋长，形成外侧与边上空间的交换。',
    moves:'B[pd] W[qf] B[pf] W[pg] B[of] W[qe] B[qd] W[qj] B[nd]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{3:'黑棋从四路靠压挂角子。',4:'白棋向下扳，争取向外活动。',5:'黑棋长，补强外侧。',6:'白棋回到三路爬，寻找边上根据。',7:'黑棋挡住，照顾角部。',9:'黑棋转向上边一间跳，局部接触取得外势。'},
    takeaways:['靠压常使黑棋变厚，白棋则需要足够的边上空间。','不要只看角地，还要看外侧是否已有支援。']
  },
  {
    id:'star-low-press-extend',corner:'星位',title:'星位 · 靠压后上边展开',family:'低挂',kind:'转换',level:'进阶',
    summary:'白棋从被压的局部转到上边求发展。',
    intro:'与靠压的起手相同，白棋选择从上边行动，黑棋则继续修补角形。',
    moves:'B[pd] W[qf] B[pf] W[pg] B[of] W[qe] B[qd] W[nc] B[oc] W[md] B[nd]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{3:'黑棋靠压挂角子，主动接触。',5:'黑棋长，补强外侧。',6:'白棋回到三路爬，保留角内手段。',8:'白棋转到上边，改变局部争夺方向。',9:'黑棋补在角侧，避免白棋轻易进入。',11:'黑棋整理上边连接，之后要比较双方发展方向。'},
    takeaways:['受压一方未必只能沿原来的边爬行。','转向上边时，要检查两处白棋是否足够安定。']
  },
  {
    id:'star-low-contact',corner:'星位',title:'星位 · 低挂靠压定型',family:'低挂',kind:'接触',level:'进阶',
    summary:'黑棋靠压后，双方在角边连续交换。',
    intro:'黑棋不急于守边，而是靠住挂角子。接触战会很快牵涉到气、断点和边上方向。',
    moves:'B[pd] W[qf] B[pf] W[pg] B[qe] W[of] B[pe] W[og] B[qg] W[qh] B[rf] W[rg] B[nd]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{3:'黑棋从四路靠压挂角子。',5:'黑棋向角边扳，直接争连接与方向。',6:'白棋在外侧反扳，避免被压在低位。',7:'黑棋补住自身，减少断点。',9:'黑棋切断白棋，接触战转为具体的气与连接。',11:'黑棋在右边补住，白棋也继续寻求边上的安定。',13:'黑棋向上边补强，局部暂可告一段落。'},
    takeaways:['接触手段必须先读气和断点。','这条线的价值随右边和上边的配置改变。']
  },
  {
    id:'star-low-wide',corner:'星位',title:'星位 · 小飞挂小飞应后托角',family:'低挂',kind:'守角',level:'入门',
    summary:'黑棋小飞应，白棋托角争取角边空间。',
    intro:'黑棋向上边小飞应，兼顾角地与边上发展；白棋随后托在星位下方，开始接触战。',
    moves:'B[pd] W[qf] B[nc] W[qd] B[qc] W[rc] B[pc] W[re] B[rb] W[sb]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{3:'黑棋向上边小飞应，兼顾角地与边上。',4:'白棋托住星位，试探角边的应法。',5:'黑棋向角内扳。',7:'黑棋继续保护角地。',10:'白棋在一路落子；黑棋的上边潜力需要后续发挥。'},
    takeaways:['小飞应后，角上仍有托角等后续手段。','白棋进入角部时，黑棋不能只看局部目数。']
  },
  {
    id:'star-low-wide-slide',corner:'星位',title:'星位 · 小飞应后点三三',family:'低挂',kind:'转换',level:'进阶',
    summary:'白棋直接点三三，黑棋从右边挡住。',
    intro:'在黑棋小飞应的形状里，白棋直接点三三，双方继续分配角地与外侧。',
    moves:'B[pd] W[qf] B[nc] W[qc] B[qd] W[rd] B[re] W[rc] B[qe]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{3:'黑棋小飞应，照顾上边。',4:'白棋点三三，优先争取角内根据。',5:'黑棋在三三下方挡，外势方向由此确定。',7:'黑棋在右边挡住，限制白棋。',9:'黑棋补外侧，白棋已经在角里立足。'},
    takeaways:['同样的小飞应，白棋也可选择更直接的角内行动。','黑棋外势面向的边是否有价值，是选择挡法的关键。']
  },
  {
    id:'star-low-pincer',corner:'星位',title:'星位 · 小飞挂二间高夹点三三',family:'夹攻',kind:'夹攻',level:'进阶',
    summary:'黑棋夹住挂角子，白棋转进角里。',
    intro:'黑棋在右边二间高夹，白棋没有直接出逃，而是先点三三利用角内空隙安定。',
    moves:'B[pd] W[qf] B[pi] W[qc] B[qd] W[pc] B[od] W[rd] B[re] W[rc] B[qe] W[nc] B[pf]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_keima.sgf',
    notes:{3:'黑棋在右边二间高夹，限制白棋沿边展开。',4:'白棋点三三，改变受夹的局面。',5:'黑棋在三三下方挡，开始构筑外侧。',7:'黑棋沿四路长，争取外势。',9:'黑棋在右边挡住，角内与外侧继续交换。',13:'黑棋补在外侧；夹攻子的价值要放回全盘看。'},
    takeaways:['夹攻前要看夹攻子是否有援军。','白棋入角后，黑棋外侧形状的厚薄比单纯角地更重要。']
  },
  {
    id:'star-high-jump',corner:'星位',title:'星位 · 高挂一间跳应',family:'高挂',kind:'应法',level:'入门',
    summary:'面对高挂，黑棋先向上边跳出。',
    intro:'白棋高挂星位，黑棋向上边一间跳，白棋再利用角上空间寻求根据。',
    moves:'B[pd] W[pf] B[nd] W[qd] B[qc] W[qe] B[rc] W[qj] B[jc]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_other.sgf',
    notes:{2:'白棋从下方高挂，重视外侧活动。',3:'黑棋向上边一间跳，避免被局限在角内。',4:'白棋转向角上试探。',5:'黑棋挡住角内。',7:'黑棋继续整理角形。',9:'黑棋在上边大幅展开，呼应先前的一间跳。'},
    takeaways:['高挂后的应法应结合外侧布局。','黑棋跳出后，白棋仍有角上试探的手段。']
  },
  {
    id:'star-high-wide',corner:'星位',title:'星位 · 高挂小飞应',family:'高挂',kind:'应法',level:'入门',
    summary:'黑棋把重心放在上边，白棋在角边安定。',
    intro:'面对高挂，黑棋向上边小飞应，白棋抓住角边的空隙继续行棋。',
    moves:'B[pd] W[pf] B[nc] W[qd] B[qc] W[qe] B[rc] W[qj]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_other.sgf',
    notes:{2:'白棋高挂，先试探黑棋在上边的态度。',3:'黑棋小飞应，重视上边的展开。',4:'白棋托住星位，争取角边空间。',5:'黑棋向角内扳。',7:'黑棋继续守角。',8:'白棋向右边延伸，让挂角子有活动空间。'},
    takeaways:['小飞应兼顾角地与边上，角边仍留有接触手段。','白棋安定后，双方要重新比较上边大场。']
  },
  {
    id:'star-high-shoulder',corner:'星位',title:'星位 · 三路侵消靠压',family:'侵消',kind:'接触',level:'进阶',
    summary:'白棋在星位下方靠近，双方短兵相接。',
    intro:'白棋在右边三路落子，黑棋从上方压住。这个局部展示边上根据与外侧厚势的交换。',
    moves:'B[pd] W[qe] B[qd] W[pe] B[oe] W[od] B[re] W[rf] B[rd]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/hoshi_other.sgf',
    notes:{2:'白棋从右边靠近星位，先争取低位根据。',3:'黑棋挡住上方，决定外侧方向。',4:'白棋沿边长出，不让自己被封死。',5:'黑棋压住白棋，争取厚势。',7:'黑棋转向右边，防止白棋轻易做大。',9:'黑棋补好边上形状，之后要看白棋是否安定。'},
    takeaways:['低位侵消常以角地交换外侧厚势。','接触之后先查断点与气。']
  },
  {
    id:'sansan-side-approach',corner:'三三',title:'三三 · 肩冲',family:'肩冲',kind:'应法',level:'入门',
    summary:'角内三三已有实地，双方转而争外侧。',
    intro:'黑棋先占三三，白棋在四四肩冲。黑棋应角后，白棋继续在外侧争取空间。',
    moves:'B[qc] W[pd] B[qd] W[pe] B[ob] W[md] B[rf] W[pg]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/sansan.sgf',
    notes:{1:'黑棋占三三，角地较直接，但对外侧影响较少。',2:'白棋在四四肩冲，限制三三向外发展。',3:'黑棋先护角，避免被封得过紧。',4:'白棋沿上边压住，要求黑棋低位应对。',5:'黑棋补在角边，守住实地。',6:'白棋往上边展开，外侧棋形逐渐清晰。',8:'白棋继续巩固外侧。'},
    takeaways:['三三开局角地稳，外侧发展通常需要另找机会。','白棋逼近的方向由全盘配置决定。']
  },
  {
    id:'sansan-close-approach',corner:'三三',title:'三三 · 靠后外扳',family:'靠角',kind:'接触',level:'进阶',
    summary:'白棋贴近三三，黑棋守住角边。',
    intro:'白棋靠住三三，黑棋向外扳，白棋则向外取得活动空间。',
    moves:'B[qc] W[pc] B[pd] W[qd] B[qe] W[rd] B[oc] W[pb] B[oe]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/sansan.sgf',
    notes:{1:'黑棋占三三，把角地作为起点。',2:'白棋靠住三三，直接试探角边应法。',3:'黑棋向外扳，争取外侧。',4:'白棋扳在右边，继续接触。',5:'黑棋向外长出，避免被困在低位。',7:'黑棋回到角边补形。',9:'黑棋补外侧；白棋的后续发展取决于上边配置。'},
    takeaways:['近身接触要留意气和断点。','三三角的实地与白棋外侧活动通常可以交换。']
  },
  {
    id:'mokuhazushi-high',corner:'目外',title:'目外 · 小目挂角小飞应',family:'小目挂角',kind:'应法',level:'进阶',
    summary:'白棋在小目挂角，黑棋小飞应后争取外侧。',
    intro:'黑棋从目外起手，角部方向并不对称。白棋在小目挂角后，黑棋小飞应，随后双方整理角边形状。',
    moves:'B[oc] W[qd] B[pe] W[qe] B[pf] W[qg] B[jc]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/mokuhazushi.sgf',
    notes:{1:'黑棋占目外，偏向上边发展。',2:'白棋在小目挂角，要求黑棋选择守角方向。',3:'黑棋从目外小飞应，争取外侧。',4:'白棋沿右边长，先争取形状。',5:'黑棋继续向外长，扩大外侧影响。',7:'黑棋转向上边大场，呼应目外的方向。'},
    takeaways:['目外本身带有明显的方向性。','黑棋能否在上边发挥，是判断这条交换的重点。']
  },
  {
    id:'mokuhazushi-low',corner:'目外',title:'目外 · 小目挂角后长出',family:'小目挂角',kind:'转换',level:'进阶',
    summary:'白棋从接触战转为低位立足。',
    intro:'同样面对目外，白棋在被压后选择较低的路线安定，黑棋向外获得影响力。',
    moves:'B[oc] W[qd] B[pe] W[qe] B[pf] W[qf] B[pg] W[qh]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/mokuhazushi.sgf',
    notes:{2:'白棋在小目挂入目外角。',3:'黑棋从目外小飞应，争取外侧。',4:'白棋向右边长出。',5:'黑棋向外长，取外势。',6:'白棋继续沿三路长，放缓争中央的速度。',7:'黑棋长出，减少被扳断的危险。',8:'白棋继续沿右边低位行棋，外侧厚势留给黑棋。'},
    takeaways:['低位安定的代价是让对方取得外侧厚势。','目外角的主方向通常在它偏向的一边。']
  },
  {
    id:'mokuhazushi-corner',corner:'目外',title:'目外 · 三三挂角小飞应',family:'三三挂角',kind:'应法',level:'进阶',
    summary:'白棋在三三挂角，黑棋以小飞应对。',
    intro:'白棋选择更靠近角内的挂法，迫使黑棋在角地和外侧之间作出具体选择。',
    moves:'B[oc] W[qc] B[pe] W[qe] B[pf] W[qf] B[pg]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/mokuhazushi.sgf',
    notes:{1:'黑棋从目外起手，兼顾角和上边。',2:'白棋在三三挂角，直接争取实地。',3:'黑棋从目外小飞应，争取外侧。',4:'白棋沿右边一间跳。',5:'黑棋继续向外长，着眼于厚势。',7:'黑棋补在外侧，维持连接。'},
    takeaways:['角内挂法会更快确定角地归属。','目外的外侧潜力需要周边棋子支持。']
  },
  {
    id:'takamoku-corner',corner:'高目',title:'高目 · 四路逼近守角',family:'四路逼近',kind:'守角',level:'进阶',
    summary:'黑棋高目起手，白棋从角侧逼近。',
    intro:'高目重视外侧，角内留有余地。白棋从四路逼近后，黑棋用低位着法守住角地。',
    moves:'B[od] W[qd] B[qc] W[rc] B[pc] W[re] B[kc] W[pf]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/takamoku.sgf',
    notes:{1:'黑棋占高目，布局重心较高。',2:'白棋从右边四路逼近，试探角内空隙。',3:'黑棋落到三路守角，先固定实地。',4:'白棋继续在右边接触。',5:'黑棋补在角边，减少白棋的潜入。',7:'黑棋转到上边展开，利用高目的外侧方向。',8:'白棋也向外伸展，局部暂时告一段落。'},
    takeaways:['高目角的外侧潜力较大，角地需要额外照顾。','黑棋守角后，白棋常能在边上活动。']
  },
  {
    id:'takamoku-press',corner:'高目',title:'高目 · 逼近后靠压',family:'四路逼近',kind:'接触',level:'高阶',
    summary:'黑棋主动靠压，双方在右边低位行棋。',
    intro:'白棋靠近高目角，黑棋选择立即接触，把局部引向压长与角上争夺。',
    moves:'B[od] W[qd] B[qe] W[re] B[pe] W[qf] B[rf] W[rg] B[rd] W[sf] B[qc]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/takamoku.sgf',
    notes:{2:'白棋从右边逼近高目角。',3:'黑棋靠住白棋，主动决定接触战的方向。',4:'白棋沿右边长出。',5:'黑棋继续从内侧压，争取外侧厚度。',6:'白棋向下伸展，避免被困在角里。',7:'黑棋在右边应对，保持连接。',9:'黑棋补角，防止实地流失过多。',11:'黑棋最后回到角内，局部取舍已形成。'},
    takeaways:['靠压会让局部很快进入气紧的接触战。','高目的外势价值需要和白棋边上安定一起比较。']
  },
  {
    id:'takamoku-high',corner:'高目',title:'高目 · 高挂后外侧展开',family:'高位挂角',kind:'转换',level:'高阶',
    summary:'黑棋迎着白棋高挂向外应，双方在上边转换。',
    intro:'白棋靠近高目角后，黑棋不马上落到低位守角，而是先向外发展；角内与上边的取舍随之出现。',
    moves:'B[od] W[qd] B[pf] W[oc] B[nc] W[pc] B[nd] W[rf]',
    source:'https://github.com/gnu-mirror-unofficial/gnugo/blob/master/patterns/takamoku.sgf',
    notes:{1:'黑棋高目起手，着眼于外侧。',2:'白棋从右边逼近。',3:'黑棋从外侧应，优先保持高度。',4:'白棋靠向角里，试探黑棋的弱点。',5:'黑棋向上边补强，继续争厚势。',6:'白棋进入角内，取得实地机会。',7:'黑棋完善外侧连接。',8:'白棋转向右边展开，形成角地与外侧的交换。'},
    takeaways:['高目可以接受角地与外势的转换。','是否值得让白棋入角，取决于外侧厚势的用途。']
  }
];
