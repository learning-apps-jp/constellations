# 星座

中学生向けの星空シミュレーション。日周運動と地球の自転、年周運動と地球の公転を視覚的に調べられます。

公開URL：https://learning-apps-jp.github.io/constellations/

## 使い方
- 一晩の動き：時刻を変えて星の動きを観察。
- 季節の変化：21時を固定して日付を変更。
- 比較で現在と2時間後・1か月後を重ねて表示。
- 方角・星座の設定と宇宙からの概念図は開閉式。
- iPad横向きでは星図を左、操作を右に配置。

## 科学的なモデル
NASA HEASARC BSC5Pの実在する恒星905個を使用。歳差・固有運動を補正し、東京（北緯35.7度・東経139.7度）の方位と幾何学的高度を計算。太陽位置は米国海軍天文台の近似式。表示期間は2026年（比較先に2027年1月を含む）。

真上を中心とする立体射影で全天を表示。円周は地平線。縦横の縮尺は共通なので画面比率で星座が引き伸ばされません。局所角度は保ちますが、広範囲の形・大きさには投影による変化が残ります。星座線、星の大きさ、空の色は説明用です。

大気差、章動、年周光行差、地形、天候、月・惑星は省略。精密観測や日の出時刻の予報用ではありません。実機iPad Safariのタッチ検証と授業での学習効果の測定は未実施。

## 検証
`node check.cjs` で日時・方位・地平線・真上・局所角度・13星座グループのPC/モバイル形状一致を検証できます。元の開発環境ではJPLの太陽72件、SOFA由来の恒星14480件とも比較し、最大太陽高度差0.00986度、最大恒星方向差0.00836度でした。これはサンプル検証であり全日時の精度保証ではありません。

## 出典
- https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html
- https://aa.usno.navy.mil/faq/sun_approx
- https://eco.mtk.nao.ac.jp/koyomi/wiki/BBFEB9EF2FB9B1C0B1BBFEA4C8C2C0CDDBBBFE.html
- https://proj.org/en/stable/operations/projections/stere.html
- https://www.mext.go.jp/content/20230522-mxt_kyoikujinzai02-000033060_04.pdf#page=108

## ローカルで開く
静的なHTML/JavaScript/CSSアプリです。ローカルHTTPサーバーでこのディレクトリを配信してください。ビルド不要。GitHub Pagesはmainブランチのルートから配信。
