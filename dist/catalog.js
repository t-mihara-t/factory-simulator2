/* Original vehicle types and reusable production-management challenges. */
(function(root){'use strict';
const VEHICLES={
 kintetsu:{name:'観光旅客車',code:'KT',sale:430,cost:285,work:[3,4,11,4],family:'旅客'},
 e235:{name:'都市通勤車',code:'CT',sale:820,cost:590,work:[4,15,6,5],family:'通勤'},
 odakyu:{name:'近郊通勤車',code:'EX',sale:610,cost:415,work:[16,4,5,4],family:'通勤'},
 n700:{name:'高速旅客車',code:'HS',sale:1200,cost:840,work:[4,5,8,21],family:'旅客'},
 panorama:{name:'展望旅客車',code:'PN',sale:920,cost:610,work:[20,5,7,4],family:'旅客'},
 freight:{name:'重量運搬車',code:'FR',sale:900,cost:590,work:[4,21,8,5],family:'貨物'},
 modular:{name:'連結ユニット車',code:'MD',sale:850,cost:560,work:[4,5,21,4],family:'貨物'},
 precision:{name:'計測試験車',code:'TS',sale:1050,cost:700,work:[5,4,6,23],family:'試験'}
};
const LAYOUTS={balanced:{name:'均等編成',speed:[1,1,1,1]},design:{name:'設計重視',speed:[2,.82,.82,.82]},machining:{name:'加工重視',speed:[.82,2,.82,.82]},assembly:{name:'組立重視',speed:[.82,.82,2,.82]},inspection:{name:'検査重視',speed:[.82,.82,.82,2]}};
const CONCEPTS=[
 ['flow','流れの発見','制約工程','長い工程へ応援を集める'],
 ['release','出発のタイミング','着工管理','受注と着工を分ける'],
 ['wip','小さな仕掛','仕掛上限','工場に流す量を絞る'],
 ['buffer','途中でひと休み','中間在庫','完成前に安い倉庫で待つ'],
 ['parallel','ふたつの道','並列機械','空いているラインへ分ける'],
 ['mix','色とりどりの注文','製品構成','案件ごとに詰まる工程を見抜く'],
 ['design','図面の山を越えて','設計制約','設計へ人と能力を配分する'],
 ['machining','加工のリズム','加工制約','加工待ちが増える前に投入を調整する'],
 ['inspection','最後の関門','検査制約','検査の余裕を残す'],
 ['moving','移りゆく混雑','移動する制約','応援後は別工程も見る'],
 ['edd','急ぎの一両','納期順','近い納期を先に流す'],
 ['slack','余裕を読む','クリティカル比','残り納期と残り工数を比べる'],
 ['short','小さな車両から','短時間順','短い仕事で待ちを減らす'],
 ['setup','おそろいの列','段取り替え','同じ車種をまとめる'],
 ['family','色分け工場','車種専用化','ラインごとに車種を分ける'],
 ['arrival','注文の波','到着変動','一度に来ても一度に着工しない'],
 ['variation','違う長さのパズル','工数変動','平均だけでなく長い案件に備える'],
 ['capacity','ぎりぎりの能力','有限能力','能力以上の受注を見送る'],
 ['margin','価値ある一秒','製品構成と利益','制約の時間と利益を比べる'],
 ['material','部材の到着','材料制約','部材待ちを着工予定に織り込む'],
 ['cadence','発車の拍子','投入の平準化','着工の間隔をそろえる'],
 ['storage','小さな倉庫','有限バッファ','置き場所を使い切らない'],
 ['transfer','ラインをつなぐ','代替経路','運搬時間も含めて移す'],
 ['team','ふたりの工夫','多能工の配分','応援を分けるか集中するか決める'],
 ['layout','私の編成','ラインバランシング','案件の工程配分に合わせて組む'],
 ['rush','飛び込み急行','動的再計画','新しい急ぎ便で順番を見直す'],
 ['pull','空きに合わせて','プル生産','後工程の空きから逆算する'],
 ['jit','ぴったり納車','ジャストインタイム','出荷に近い時刻に仕上げる'],
 ['utilization','働きすぎない工場','稼働率と待ち','忙しさより出荷を優先する'],
 ['integrated','つながる工場','全体最適','納期・在庫・利益を同時に整える']
].map(([id,title,theory,action])=>({id,title,theory,action}));
const api={VEHICLES,LAYOUTS,CONCEPTS};root.RailworksCatalog=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
