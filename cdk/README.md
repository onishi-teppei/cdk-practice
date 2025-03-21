# CDKプロジェクト概要

このディレクトリはAWS CDKを使用してインフラストラクチャをコードとして管理するためのものです。

## プロジェクト構造

```
cdk/
├── bin/
│   └── cdk.ts           # メインのCDKアプリケーション
├── lib/
│   ├── vpc-stack.ts     # VPCスタック
│   ├── ecr-stack.ts     # ECRスタック
│   ├── rds-stack.ts     # RDSスタック
│   └── ecs-fargate-online-stack.ts  # ECS Fargate, ELB スタック
└── cdk.json             # CDK設定ファイル
```

## スタックの概要

### VPCスタック
- VPCの作成
- パブリック/プライベートサブネット
- インターネットゲートウェイ
- NATゲートウェイ
- ルートテーブル

### ECRスタック
- コンテナイメージリポジトリ
- リポジトリポリシー

### RDSスタック
- Aurora MySQL設定
- セキュリティグループ
- サブネットグループ

### ECS Fargateスタック
- Fargateサービス
- タスク定義
- ALB設定
- オートスケーリング

## 環境設定

環境変数は`cdk.json`で管理されています：

```json
{
  "dev": {
    "env": {
      "account": "YOUR_ACCOUNT_ID",
      "region": "ap-northeast-1"
    },
    "AWSENV": "dev",
    "APPVPC_CIDR": "10.30.0.0/16",
    ...
  }
}
```

## デプロイメント
to2go-infraリポジトリはgithub actionsで自動で流している。
https://github.com/scg-nxw/to2go-infra/blob/5fee772a291a3f4532c1ddb1c11269ced03aab5a/.github/workflows/prod-cdk-pipline.yml

### デプロイ手順

1. 依存関係のインストール
```bash
npm ci
```
package-lock.json に基づいて依存関係をインストール
node_modules/ を削除してからインストール

2. ビルド
```bash
npm run build
```
実際のコマンドはcdk/package.json に記載されている↓
```
"build": "./node_modules/typescript/bin/tsc",
```

- buildの実施
  - .tsファイルを.jsファイルに変換
  - 型チェックの実行
  - tsconfig.jsonの設定に基づいて処理

3. 環境の確認（差分チェック）
```bash
npm run cdk:diff-dev
```
実際のコマンドはcdk/package.json に記載されている↓
```
"cdk:diff-dev": "cdk diff -c environment=dev || true",
```

- cdk diff
  - [ローカルで変更した内容]と[デプロイ済みのCloudFormationスタックのテンプレート]の比較
  - 実際のリソースを見てくれるわけではない
- -c environment=dev
  - environment=devというコンテキスト変数を設定し、開発環境用の設定を指定します

本番にも `|| true` が入っているのが心配

4. デプロイの実行
```bash
npm run cdk:deploy-dev
```
実際のコマンドはcdk/package.json に記載されている↓
```
"cdk:deploy-dev": "cdk deploy --all --require-approval never -c environment=dev"
```
- cdk deploy
  - AWSのCDK（Cloud Development Kit）を使用してインフラストラクチャをデプロイするための基本コマンド
  - 裏でCFnが実行される
- --all
  - すべてのスタックをデプロイする
  - スタックごとに指定もできる
- --require-approval never
  - デプロイ時の承認プロンプトをスキップ。セキュリティに関わる変更であっても自動的にデプロイを進める

## その他cdkコマンド
- 現在の CDK アプリに含まれるスタックの一覧を表示
  ```
  cdk list
  ```
- CloudFormation テンプレートを生成
  ```
  cdk synth
  ```
- 変更セットだけ作る
  - https://qiita.com/nasuB7373/items/9a43e1395f70a1862d08
  ```
  cdk deploy -m='prepare-change-set'
  or
  dk deploy --no-execute
  ```

## 主な変更ポイント

### 1. VPC設定の変更
```typescript
const vpc = new ec2.Vpc(this, `${context.AWSENV}-to2go-app-vpc`, {
  ipAddresses: ec2.IpAddresses.cidr(context.APPVPC_CIDR),
  maxAzs: 2,
  vpcName: `${context.AWSENV}-to2go-app-vpc`,
  subnetConfiguration: [],
});
```

- CIDRレンジの変更
- サブネット構成の変更
- アベイラビリティゾーンの設定

### 2. ECS設定の変更
```typescript
const serviceTaskDefinition = new ecs.FargateTaskDefinition(this, 'ServiceTaskDefinition', {
  executionRole: executionRole,
  taskRole: serviceTaskRole,
  cpu: context.ONLINECPU,
  memoryLimitMiB: context.ONLINEMEMORY,
});
```

- コンテナスペックの調整
- タスク数の変更
- オートスケーリング設定

### 3. セキュリティグループの設定
```typescript
secgroup01.addIngressRule(
  ec2.Peer.ipv4('10.30.0.0/16'),
  ec2.Port.tcp(3306)
);
```

- インバウンド/アウトバウンドルールの追加
- ポート開放の設定

## 環境変数の追加方法

1. `cdk.json`に新しい環境変数を追加
```json
{
  "dev": {
    "NEW_VARIABLE": "value"
  }
}
```

2. スタック内で環境変数を使用
```typescript
const value = context.NEW_VARIABLE;
```

## スタックの削除
```bash
cdk destroy --all -c environment=dev
```

個別でスタックを指定しての削除も可能
```bash
cdk destroy [stack名] -c environment=dev
```


## 参考リンク

- [チュートリアル](https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/hello_world.html#hello_world_create)
- [CDK APIドキュメント](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-construct-library.html)
