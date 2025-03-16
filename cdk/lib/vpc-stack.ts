import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import {Vpc} from 'aws-cdk-lib/aws-ec2';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';

// VPC Stackクラスを作成、StackはAWSリソースを管理するコンテナ
export class VpcStack extends Stack {

  public readonly vpc: Vpc; // public - 他のクラスからアクセス可能 readonly - 一度設定されたら変更不可 vpc: Vpc - VPCタイプのプロパティ

  //scope: Construct型 - このスタックの親となるコンストラクト
  //id: string型 - スタックの一意な識別子
  //props: StackProps型（オプション） - スタックのプロパティ
  constructor(scope: Construct, id: string, props?: StackProps) {
    // 親コンストラクトを設定
    super(scope, id, props);

const argContext = 'environment';
const envKey = this.node.tryGetContext(argContext);
    if (envKey == undefined)
      throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=stg`);
const context = this.node.tryGetContext(envKey);
    if (context == undefined) throw new Error('Invalid environment.');

    const vpc = new ec2.Vpc(this, `${context.AWSENV}-to2go-app-vpc`, {
      ipAddresses: ec2.IpAddresses.cidr(context.APPVPC_CIDR),
      maxAzs: 2,
      vpcName: `${context.AWSENV}-to2go-app-vpc`,
      subnetConfiguration: [],
    });

    // Internet Gateway
    const cfnInternetGateway = new ec2.CfnInternetGateway(this, `${context.AWSENV}-to2go-app-igw`, {
      tags: [{
        key: 'Name',
        value: `${context.AWSENV}-to2go-app-igw`,
       }],
    });

    // Internet GatewayをVPCにアタッチ
    const cfnVPCGatewayAttachment = new ec2.CfnVPCGatewayAttachment(this, `${context.AWSENV}-to2go-app-igw-attach`, {
      vpcId: vpc.vpcId,
      internetGatewayId: cfnInternetGateway.attrInternetGatewayId,
    });

    // パブリックルートテーブルを作成
    const publicRouteTable = new ec2.CfnRouteTable(this, `${context.AWSENV}-to2go-app-public-rtb`, {
      vpcId: vpc.vpcId,
      tags: [{ key: "Name", value: `${context.AWSENV}-to2go-app-public-rtb` }]
    });

    // パブリックルートテーブルにインターネットゲートウェイを設定
    const igwRoute = new ec2.CfnRoute(this, `${context.AWSENV}-to2go-app-public-rtb-igw`, {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: "0.0.0.0/0",
      gatewayId: cfnInternetGateway.ref
    });

    // パブリックサブネットを作成
    const publicSubnet1a = new ec2.CfnSubnet(this, `${context.AWSENV}-to2go-app-public-subnet1a`, {
      vpcId: vpc.vpcId,
      availabilityZone: "ap-northeast-1a",
      cidrBlock: context.APPVPC_PUBSUB1,
      mapPublicIpOnLaunch: true,
      tags: [{ key: "Name", value: `${context.AWSENV}-to2go-app-public-subnet1` }]
    });

    // パブリックサブネットを作成
    const publicSubnet1c = new ec2.CfnSubnet(this, `${context.AWSENV}-to2go-app-public-subnet1c`, {
      vpcId: vpc.vpcId,
      availabilityZone: "ap-northeast-1c",
      cidrBlock: context.APPVPC_PUBSUB2,
      mapPublicIpOnLaunch: true,
      tags: [{ key: "Name", value: `${context.AWSENV}-to2go-app-public-subnet2` }]
    });

    // パブリックサブネットをルートテーブルにアタッチ
    const publicassociation1a = new ec2.CfnSubnetRouteTableAssociation(this, `${context.AWSENV}-to2go-app-public-rtb--association1a`, {
      routeTableId: publicRouteTable.ref,
      subnetId: publicSubnet1a.attrSubnetId,
    });

    // パブリックサブネットをルートテーブルにアタッチ
    const publicassociation1c = new ec2.CfnSubnetRouteTableAssociation(this, `${context.AWSENV}-to2go-app-public-rtb--association1c`, {
      routeTableId: publicRouteTable.ref,
      subnetId: publicSubnet1c.attrSubnetId,
    });

    // プライベートルートテーブルを作成
    const privateRouteTable = new ec2.CfnRouteTable(this, `${context.AWSENV}-to2go-app-private-rtb`, {
      vpcId: vpc.vpcId,
      tags: [{ key: "Name", value: `${context.AWSENV}-to2go-app-private-rtb` }]
    });

    // プライベートルートテーブルを出力
    new cdk.CfnOutput(this, 'privateRouteTableOutPut', {
      value: privateRouteTable.attrRouteTableId,
      exportName: 'appvpc-rtbId',
    });

    // プライベートサブネットを作成
    const privateSubnet1a = new ec2.CfnSubnet(this, `${context.AWSENV}-to2go-app-private-subnet1a`, {
      vpcId: vpc.vpcId,
      availabilityZone: "ap-northeast-1a",
      cidrBlock: context.APPVPC_PRISUB1,
      mapPublicIpOnLaunch: false,
      tags: [{ key: "Name", value: `${context.AWSENV}-to2go-app-private-subnet1` }]
    });

    const privateSubnet1c = new ec2.CfnSubnet(this, `${context.AWSENV}-to2go-app-private-subnet1c`, {
      vpcId: vpc.vpcId,
      availabilityZone: "ap-northeast-1c",
      cidrBlock: context.APPVPC_PRISUB2,
      mapPublicIpOnLaunch: false,
      tags: [{ key: "Name", value: `${context.AWSENV}-to2go-app-private-subnet2` }]
    });

    // プライベートサブネットをルートテーブルにアタッチ
    const privateassociation1a = new ec2.CfnSubnetRouteTableAssociation(this, `${context.AWSENV}-to2go-app-private-rtb-association1a`, {
      routeTableId: privateRouteTable.ref,
      subnetId: privateSubnet1a.attrSubnetId,
    });

    const privateassociation1c = new ec2.CfnSubnetRouteTableAssociation(this, `${context.AWSENV}-to2go-app-private-rtb-association1c`, {
      routeTableId: privateRouteTable.ref,
      subnetId: privateSubnet1c.attrSubnetId,
    });

    // Elastic IP
    // const eip = new ec2.CfnEIP(this, `${context.AWSENV}-to2go-app-eip-natgw`,{
    //   tags: [{
    //     key: 'Name',
    //     value: `${context.AWSENV}-to2go-app-eip-natgw`,
    //   }],
    // });

    // NAT Gateway
    // const cfnNatGateway = new ec2.CfnNatGateway(this, `${context.AWSENV}-to2go-app-natgw`, {
    //   subnetId: publicSubnet1a.attrSubnetId,
    //   allocationId: eip.attrAllocationId,
    //   connectivityType: 'public',
    //   tags: [{
    //     key: 'Name',
    //     value: `${context.AWSENV}-to2go-app-natgw`,
    //   }],
    // });

    // // NAT Gateway route
    // const natRoute = new ec2.CfnRoute(this, `${context.AWSENV}-to2go-app-private-rtb-nat`, {
    //   routeTableId: privateRouteTable.ref,
    //   destinationCidrBlock: "0.0.0.0/0",
    //   natGatewayId: cfnNatGateway.attrNatGatewayId,
    // });

    //VPCフローログの設定
    //Log用S3取得
    // const accessLogsBucket = s3.Bucket.fromBucketName(this, "MyBucket", `${context.AWSENV}-to2go-app-s3-access-logs-bucket`);

    // vpc.addFlowLog('FlowLogS3', {
    //   destination: ec2.FlowLogDestination.toS3(accessLogsBucket,`vpc-flow-log/${context.AWSENV}-to2go-app-vpc/`)
    // });
  };
};
