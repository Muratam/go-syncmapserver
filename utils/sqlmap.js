
// 引数のパス一覧の中のGoのコード中からSQLの関係図を生成する
// router.Get("/hoge",func(){...}) みたいなコードは全てflattenした場合を想定。
// 1. \s*?func\s+?(\S+?)\(.*?\) を関数の始まりのラインとして解釈して、
// 2. [`"]\s*(SELECT|DELETE|INSERT|UPDATE) .+?[`"] があるものをSQL文として解釈する。
//   - SELECT は依存しているテーブル名を全て抜き出し、 他は...?
// 3. SQL文を含む関数一覧が取れるので関数同士の依存関係のグラフも生成できる。
// 4. SQLをパースして、テーブルとの関係を取得してgraphvizする。

const fs = require("fs")
function parseGoSQLRelation(content) {
  function escape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
  }
  function getTableName(query) {
    query = query.trim().replace(/[\t\n]/g, " ")
    let commands = query.split(" ")
    let queryType = commands[0].toUpperCase()
    let target = {
      "SELECT": "FROM",
      "UPDATE": "UPDATE",
      "INSERT": "INTO",
      "DELETE": "FROM",
    }[queryType]
    for (let i = 0; i < commands.length; i++) {
      let command = commands[i].toUpperCase();
      if (command !== target) {
        continue;
      }
      return [commands[i + 1].replace(/[^_0-9a-zA-Z]/g, ""), queryType];
    }
    console.error("ERROR!")
  }
  // 見つかった関数
  let textIndexToFuncName = new Array(content.length);
  let functionNames = []
  let preI = 0
  let preName = "???"
  let havingFunctionsMap = {}
  for (let found of content.matchAll(/func\s+?(\S+?)\(.*?\)/g)) {
    let funcName = found[1]
    let index = found.index
    for (let i = preI; i < index; i++) {
      textIndexToFuncName[i] = preName
    }
    functionNames.push(funcName)
    havingFunctionsMap[funcName] = []
    preName = funcName
    preI = index
  }
  for (let i = preI; i < content.length; i++) {
    textIndexToFuncName[i] = preName
  }
  // 見つかったSQL
  // SET ALTER RENAME DROP REPLACE あたりは知らない...
  let sqlFounds = content.match(/"\s*(SELECT|DELETE|INSERT|UPDATE)\s.+?"/ig)
  for (let other of content.match(/`\s * (SELECT | DELETE | INSERT | UPDATE) \s.+? `/ig) || []) sqlFounds.push(other)
  preI = 0
  let functionNameToSQL = {}
  for (let sql of sqlFounds) {
    let index = content.substring(preI).search(escape(sql)) + preI
    preI = index
    let functionName = textIndexToFuncName[index]
    let normalized = sql.substring(1, sql.length - 1)
    let [table, queryType] = getTableName(normalized)
    functionNameToSQL[functionName] = (functionNameToSQL[functionName] || []).concat(
      { query: normalized, table: table, type: queryType })
  }
  // 見つかったトークン
  for (let found of content.matchAll(/([_0-9a-zA-Z]+)/g)) {
    let foundFuncName = found[0]
    let rootFuncName = textIndexToFuncName[found.index]
    if (havingFunctionsMap[rootFuncName] === undefined) continue;
    if (havingFunctionsMap[foundFuncName] === undefined) continue;
    if (rootFuncName === foundFuncName) continue;
    havingFunctionsMap[rootFuncName].push(foundFuncName)
  }
  for (let key in havingFunctionsMap) {
    havingFunctionsMap[key] = Array.from(new Set(havingFunctionsMap[key]))
  }
  return {
    functionNames,
    havingFunctionsMap,
    functionNameToSQL
  }
}
function joinFiles(filenames) {
  let content = ""
  for (let filename of filenames) {
    if (!filename.endsWith(".go")) continue;
    content += fs.readFileSync(filename, "utf8")
  }
  return content
}
function writeDot(parsed) {
  let { functionNames, havingFunctionsMap, functionNameToSQL } = parsed
  let funcStr = ""
  for (let func of functionNames) {
    funcStr += `${func};`
  }
  let funcRel = ""
  for (let src in havingFunctionsMap) {
    for (let dst of havingFunctionsMap[src]) {
      funcRel += `${src} -> ${dst};`
    }
  }
  let tableRel = ""
  for (let src in functionNameToSQL) {
    for (let dst of functionNameToSQL[src]) {
      // dst.query : all of query
      // dst.type  : "SELECT" / "INSERT" / ...
      if (dst.type === "SELECT") {
        funcRel += `${src} -> ${dst.table};`
      } else { // INSERT / DELETE / UPDATE
        funcRel += `${dst.table} -> ${src};`
      }
    }
  }

  return `
  digraph  {
    layout = "neato";
    overlap=false;
    splines=false;
    edge [len=0.0];
    node [
      landscape = true,
      width = 1,
      height = 1,
      fontname = "Helvetica",
      style="filled",
      fillcolor="#fafafa",
    ];
    edge [
      len=1.8,
      fontsize="20",
      // penwidth="2",
      fontname = "Helvetica",
      style="dashed",
    ];
    ${funcStr}
    ${funcRel}
    ${tableRel}
  }
  `
}

// 除外したい場合もあるだろうので、 `node sqlmap.js ./*.go` みたいにするのがいいかな
let joinedContents = joinFiles(process.argv)
let parsed = parseGoSQLRelation(joinedContents)
let dotted = writeDot(parsed)
fs.writeFileSync("sqlmap.dot", dotted)