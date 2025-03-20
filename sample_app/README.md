# プロジェクト概要
簡単なフォームの入力と表示をするだけのアプリ

## デプロイ環境

### AWS環境構成
* ECS Fargate
* ECR (コンテナレジストリ)
* リージョン: ap-northeast-1 (東京)

### デプロイフロー
1. GitHub Actionsによる自動デプロイ
   - masterブランチへのプッシュ時に自動実行
   - `sample_app/**` 配下のファイル変更時のみ実行
   - 手動トリガー（workflow_dispatch）も可能

2. デプロイプロセス
   - AWS認証
   - ECRへのログイン
   - Dockerイメージのビルドとプッシュ
   - ECSタスク定義の更新
   - ECSサービスのデプロイ
