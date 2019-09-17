# Go SyncMap Server
- SyncMap でトランザクションを頑張るサーバー。Goアプリの上で動かす。

1. 1台目のアプリで動かすので1台目->1台目のTCPロスがなくて速い
  (テストではTCPを経由しても(多分どちらもGoなので[]byteの変換が容易なため)Redisよりも速い)
1. トランザクションが可能(lock / unlock)
1. 大量のデータの初期化が容易(Redisは一括で送信するのが大変)
1. list(=保存順序を気にしないデータの配列) も扱える
1. On Memory
1. 30秒毎にバックアップファイルを作成してくれるので安心
1. 読み込み時にバックアップファイルがあればそれを読み込む
1. 内部的には[]byteで保存しているが、メソッドを生やしているので型の変換が簡単。
1. 複数台の起動順序はOK (要求があって初めて接続を開始するので)
1. キー毎にロックされているかを確認可能()
1. キーの要素数を確認可能
1. MULTIGET / MULTISET があるので N+1問題にも対応！

# やるだけ
1. テストをきちんと書いておきたい。GoDocみたいなのが欲しい。
1. TODO: goコードの中からSQLを吸い出したい
1. TODO: Redisコンパチブルにしたい
1. TODO: 一つのキーに保存された list の 全てを一括取得も実装しておきたい
1. join / split はもっと高速化できそう
1. 過去にRedisを使っていたものを代替してテストしておきたい

# NOTE
- キー一覧はすぐに取得できるが、その表す型が何かはわからない(最適化のために []byte型 で保存されている)ので、汎用的なCLIは作成できない。適宜型とキーの対応を書いたGoファイルを作って読み込む必要がある。

# 使用時のヒント
- https://github.com/Muratam/isucon9q/blob/nouser/postapi.go
  - DBからのSQLでの読み込み は initializeUsersDB()
  - 特定のキーのみのロック(+1人目のトランザクションが成功したら終了) は postBuy()
