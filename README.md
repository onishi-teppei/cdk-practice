# CDKプロジェクト概要

このプロジェクトはAWS CDKを使用してインフラストラクチャをコードとして管理するためのものです。

## プロジェクト構造
cdk/
├── bin/
│ └── cdk.ts # メインのCDKアプリケーション
├── lib/
│ ├── vpc-stack.ts # VPCスタック
│ ├── ecr-stack.ts # ECRスタック
│ ├── rds-stack.ts # RDSスタック
│ └── ecs-fargate-online-stack.ts # ECS Fargateスタック
└── cdk.json # CDK設定ファイル

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

### 必要条件
- Node.js 14.x以上
- AWS CLI設定済み
- AWS CDK CLI (`npm install -g aws-cdk`)

### デプロイ手順

1. 依存関係のインストール
```bash
npm install
```

2. 環境の確認（差分チェック）
```bash
npm run cdk:diff-dev
```

3. デプロイの実行
```bash
npm run cdk:deploy-dev
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

## トラブルシューティング

1. デプロイエラー
- AWSクレデンシャルの確認
- リージョン設定の確認
- 権限の確認

2. スタックの削除
```bash
cdk destroy --all -c environment=dev
```

## 注意事項

- 本番環境へのデプロイ前は必ず`cdk diff`で変更内容を確認
- セキュリティグループの変更は慎重に行う
- 環境変数の変更はすべての環境で反映されることを確認

## 参考リンク

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/latest/guide/home.html)
- [TypeScript CDK Examples](https://github.com/aws-samples/aws-cdk-examples)
