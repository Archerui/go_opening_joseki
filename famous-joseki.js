// Named joseki: the Mi Yuting 2018 game sequence and three classical difficult families.
// The classical branches are transcribed from Kogo's Joseki Dictionary (2014).
const famousJoseki = [
  {
    id:'mi-flying-knife', title:'芈氏飞刀 · 实战外扳', aliases:'芈式飞刀 羋氏飛刀 羋刀 小芈飞刀',
    treeSources:[{sourceId:'josekle',externalId:20832}],
    corner:'星位', family:'飞刀定式', kind:'三三侵入', level:'高阶', famous:true,
    summary:'2018 年芈昱廷对童梦成，第 20 手外扳引出著名的芈氏飞刀。',
    intro:'从 2018 年中国名人战半决赛的全盘前 20 手进入。左下星位点三三后，白棋在第 20 手选择外扳；这是芈氏飞刀的关键分歧点，并非走到这里局部就已经结束。',
    moves:'B[pd] W[dd] B[pp] W[dp] B[cq] W[cp] B[dq] W[fq] B[fr] W[gr] B[eq] W[fp] B[ep] W[eo] B[do] W[bo] B[dn] W[en] B[em] W[fm]',
    source:'https://foxwq.com/news/listid/id/9552.html',
    sourceLabel:'查看芈氏飞刀手顺与背景 ↗',
    notes:{1:'黑棋先占右上星位。这里保留实战全盘手顺，方便观察左下角的周边配置。',2:'白棋占左上星位。',3:'黑棋占右下星位。',4:'白棋占左下星位，飞刀战场由此确定。',5:'黑棋在左下点三三，先争角地。',6:'白棋从上方挡住，限制黑棋沿边出头。',7:'黑棋在角内继续落子，保留角地。',8:'白棋向右侧大飞，封住角上黑棋的出路。',9:'黑棋在二路延气，避免角内棋子立即受困。',10:'白棋沿二路跟进，继续压缩黑棋的活动范围。',11:'黑棋从角内出头，争取向外连接。',12:'白棋在外侧加压，保持封锁。',13:'黑棋继续向中央顶出；双方的气开始变得关键。',14:'白棋向上推进，扩大外侧厚势。',15:'黑棋向左侧拐，留下角边的反击余地。',16:'白棋在左边低位应对，控制黑棋的出路。',17:'黑棋向上延伸，试图打通外侧。',18:'白棋贴着黑棋继续延气，局部对杀要逐手计算。',19:'黑棋再向中央长出，给白棋提出最后一个关键选择。',20:'白棋在 F7 外扳，这一手就是芈氏飞刀的标志。之后变化很长，不能凭此图断言角内死活。'},
    takeaways:['关键手是白第 20 手 F7 外扳；此前是星位点三三后的一条飞刀手顺。','后续涉及角内死活和全盘厚势，实战需继续读棋。']
  },
  {
    id:'muramasa-sword', title:'村正妖刀 · 避繁分支', aliases:'妖刀定式 村正的妖刀 Magic Sword Muramasa',
    treeSources:[{sourceId:'josekle',externalId:28977}],
    corner:'小目', family:'村正妖刀', kind:'二间高夹', level:'高阶', famous:true,
    summary:'高挂遇二间高夹，小飞靠入后选择避繁的角上走法。',
    intro:'小目一间高挂、二间高夹后，白第 4 手小飞靠入、黑第 5 手靠出，进入村正妖刀。这里展示 Kogo 棋谱中白第 8 手在角上退让、避开更繁复战斗的一支；原谱认为终点黑棋稍好，且提醒先核对征子是否对白有利。',
    moves:'B[qd] W[od] B[ld] W[qe] B[pd] W[pe] B[oe] W[rd] B[rc] W[re] B[oc] W[nd] B[nc] W[mc] B[md] W[ne] B[qb] W[of]',
    source:'https://waterfire.us/joseki.htm',
    sourceSgf:'https://raw.githubusercontent.com/billyellow/Kogo-s-Joseki-Dictionary/master/Kogo%27s%20Joseki%20Dictionary.sgf',
    sourceLabel:'查看 Kogo 定式棋谱与评注 ↗',
    notes:{1:'黑棋右上小目，局部以角地和上边方向为起点。',2:'白棋一间高挂，准备从上边接近角。',3:'黑棋二间高夹，白棋被夹在小目与夹攻子之间。',4:'白棋小飞靠入，向角边试探；下这手前应看全盘征子。',5:'黑棋在角边靠住，正式进入村正妖刀的接触变化。',6:'白棋扳出，争取连接和角部空间。',7:'黑棋长出，压迫白棋的形状。',8:'白棋退到右边，这一支选择减少接下来的复杂战斗。',9:'黑棋在二路挡住，维护角上结构。',10:'白棋向外扳，避免被完全封住。',11:'黑棋在上边补强，准备分断白棋。',12:'白棋向左侧移动，争取上边的根据。',13:'黑棋贴身追击，角边攻防仍未结束。',14:'白棋再向左展开；棋谱认为此处优于贸然在外侧拐。',15:'黑棋顶住白棋，保持夹攻压力。',16:'白棋向中央转身，处理被夹住的棋。',17:'黑棋在角内补一手，角地变得较实。',18:'白棋向外长出。这个分支以黑棋角地与白棋外侧活动作为比较重点。'},
    takeaways:['妖刀不是单一固定手顺；本支白第 4 手小飞、黑第 5 手靠后仍有多种选择。','避繁不等于局部最优：Kogo 认为此支终点黑棋稍好，征子与全盘配置仍需另行判断。']
  },
  {
    id:'large-avalanche', title:'大雪崩 · 吴清源内侧曲', aliases:'雪崩定式 大雪崩定式 Oo-Nadare Large Avalanche',
    treeSources:[{sourceId:'josekle',externalId:27135},{sourceId:'gnugo',sourceFile:'komoku.sgf',sourceNode:93}],
    corner:'小目', family:'大雪崩', kind:'靠退扳长', level:'高阶', famous:true,
    summary:'小目高挂后靠退、扳长，走入吴清源研究的内侧曲分支。',
    intro:'黑小目对白一间高挂采用靠退。双方连续扳长形成雪崩型，黑第 9 手开始进入大雪崩；本图取 Kogo 棋谱中第 13 手内侧曲的一条传统分支，展示角地、上边与右边的复杂交换。',
    moves:'B[qd] W[od] B[oc] W[pd] B[pc] W[qe] B[nc] W[nd] B[md] W[qc] B[rd] W[qb] B[rc] W[mc] B[lc] W[rb] B[re] W[mb] B[nb] W[lb] B[pb] W[qf] B[ld] W[pa] B[oa] W[rf] B[kb] W[sc]',
    source:'https://waterfire.us/joseki.htm',
    sourceSgf:'https://raw.githubusercontent.com/billyellow/Kogo-s-Joseki-Dictionary/master/Kogo%27s%20Joseki%20Dictionary.sgf',
    sourceLabel:'查看 Kogo 大雪崩变化树 ↗',
    notes:{1:'黑棋右上小目。',2:'白棋一间高挂，准备向上边发展。',3:'黑棋靠在白棋下方，开始靠退交换。',4:'白棋扳住，不愿被黑棋轻易压低。',5:'黑棋退回角内，守住角部连接。',6:'白棋继续向右边扳长，雪崩型初现。',7:'黑棋在上边出头，提出进入大雪崩的选择。',8:'白棋贴着黑棋应对，接受复杂变化。',9:'黑棋扳住白棋，进入大雪崩的关键分支。',10:'白棋转回角上，争取实地与眼位。',11:'黑棋挡住白棋，继续控制角部。',12:'白棋从二路伸出，等待黑棋选择应法。',13:'黑棋向角内曲，进入吴清源研究的传统分支。',14:'白棋在上边切断，展开后续攻防。',15:'黑棋向左压，试图取得上边厚势。',16:'白棋在角边立住，保留角地与眼位。',17:'黑棋从外侧扳出，要求白棋处理右边。',18:'白棋在上边继续推进，扩大交换。',19:'黑棋堵住上边，维持对角内的压力。',20:'白棋向左边伸展；后续仍有传统与现代不同手顺。',21:'黑棋回角部补强。',22:'白棋从右边顶出，准备改变战斗方向。',23:'黑棋在上边长出，此处棋谱还列有其他可选手段。',24:'白棋在一路试探角内气紧。',25:'黑棋跟住，避免白棋轻易活净。',26:'白棋在右侧出头。',27:'黑棋在上边补强，把外势连成整体。',28:'白棋在角边再延气。本图走到一种角地与上边厚势交换的节点，后续尚有攻防。'},
    takeaways:['大雪崩从靠退后的连续扳长进入，第 9 手是关键分歧。','第 13 手内侧曲是一条历史名型，不代表所有大雪崩分支或当代 AI 的唯一判断。']
  },
  {
    id:'taisha-slant', title:'大斜 · 接触战主干', aliases:'大斜定式 Taisha Large Slant',
    treeSources:[{sourceId:'josekle',externalId:31748}],
    corner:'目外', family:'大斜', kind:'大斜飞', level:'高阶', famous:true,
    summary:'目外遭挂角，以大斜飞应，进入征子和断点都很重要的主干。',
    intro:'黑棋从目外起手，白棋在小目方向挂角，黑第 3 手大斜飞定下名型。本图选自 Kogo 棋谱一条标为可行的复杂分支；棋谱多次提醒征子方向会影响能否进入这条线。',
    moves:'B[oc] W[qd] B[pf] W[od] B[pd] W[pe] B[pc] W[qe] B[oe] W[nd] B[qc] W[qf] B[of] W[qh] B[mb] W[ld] B[oh] W[pj] B[lg] W[jd]',
    source:'https://waterfire.us/joseki.htm',
    sourceSgf:'https://raw.githubusercontent.com/billyellow/Kogo-s-Joseki-Dictionary/master/Kogo%27s%20Joseki%20Dictionary.sgf',
    sourceLabel:'查看 Kogo 大斜变化树 ↗',
    notes:{1:'黑棋占目外，位置比小目更偏向上边。',2:'白棋从右侧挂角，要求黑棋选择行棋方向。',3:'黑棋大斜飞，是大斜定式的标志手。',4:'白棋靠入大斜飞形成的空隙，开始复杂变化。',5:'黑棋从角边应对，保留角地。',6:'白棋扳住，向外争取连接。',7:'黑棋回角内补强，暂时不让白棋取走全部角地。',8:'白棋向右侧转身；另一条白棋外侧长出的变化也存在。',9:'黑棋在中间贴住，形成多个切断点。',10:'白棋向上边伸出，进入大斜较难读的一支。',11:'黑棋在角内出头；原棋谱指出这里应格外注意正确次序。',12:'白棋向右边扳出，维持外侧空间。',13:'黑棋从外侧压，阻止白棋轻易联络。',14:'白棋向右边长出，继续整理气与连接。',15:'黑棋在上边深入，与角内黑棋形成配合。',16:'白棋从上方压住，开始限制黑棋的上边发展。',17:'黑棋向中央转身，保持两边的活动。',18:'白棋在右边跳出，寻找稳定的形状。',19:'黑棋在中央接应，照顾被分割的棋子。',20:'白棋向上边继续展开。棋谱在此将这一分支列为可行，但实战仍应核对征子和周围配置。'},
    takeaways:['目外起手、黑第 3 手大斜飞，是识别大斜定式的关键。','进入复杂接触战前，先读征子和切断点；局部结论随全盘棋子改变。']
  }
];
