"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RdsStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const aws_ec2_1 = require("aws-cdk-lib/aws-ec2");
const rds = require("aws-cdk-lib/aws-rds");
const ec2 = require("aws-cdk-lib/aws-ec2");
const cdk = require("aws-cdk-lib/core");
const ssm = require("aws-cdk-lib/aws-ssm");
const logs = require("aws-cdk-lib/aws-logs");
// import * as iam from 'aws-cdk-lib/aws-iam';
class RdsStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const argContext = 'environment';
        const envKey = this.node.tryGetContext(argContext);
        if (envKey == undefined)
            throw new Error(`Please specify environment with context option. ex) cdk deploy -c ${argContext}=stg`);
        const context = this.node.tryGetContext(envKey);
        if (context == undefined)
            throw new Error('Invalid environment.');
        //VPC取得　
        const vpc = ec2.Vpc.fromLookup(this, 'VPCapp', {
            vpcName: `${context.AWSENV}-to2go-app-vpc`,
        });
        //Subnet取得
        const private_subnet = vpc.selectSubnets({
            subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnets;
        //SubnetGroup作成
        const subnetGroup = new rds.SubnetGroup(this, `${context.AWSENV}-to2go-app-rds-subnetgroup`, {
            description: 'aurora subnet group',
            vpc: vpc,
            vpcSubnets: {
                subnets: private_subnet,
            }
        });
        //RDS用のSecurityGroup作成
        const secgroup01 = new aws_ec2_1.SecurityGroup(this, `${context.AWSENV}-to2go-app-rds-securitygroup`, {
            vpc: vpc,
            securityGroupName: `${context.AWSENV}-to2go-app-rds-securitygroup`,
        });
        //QuickSight用のSecurityGroup作成
        // const secgroup02 = new SecurityGroup(this, `${context.AWSENV}-to2go-quicksight-eni-securitygroup`, {
        //   vpc: vpc,
        //   securityGroupName: `${context.AWSENV}-to2go-quicksight-eni-securitygroup`,
        //   allowAllOutbound: false
        // });
        //RDS用のSecurityGroupにFargateからのIngressルール追加
        // const onlinesgId = cdk.Fn.importValue('online-sg-Id'); //こんな形でSGをimportする
        // const batchsgId = cdk.Fn.importValue('batch-sg-Id');
        secgroup01.addIngressRule(ec2.Peer.ipv4('10.30.0.0/16'), ec2.Port.tcp(3306));
        // secgroup01.addIngressRule(ec2.Peer.securityGroupId(batchsgId),ec2.Port.tcp(3306));
        //QuickSight用のSecurityGroupにRDSからのIngress/Egressルール追加
        // secgroup02.addIngressRule(ec2.Peer.securityGroupId(secgroup01.securityGroupId),ec2.Port.allTcp());
        // secgroup02.addEgressRule(ec2.Peer.securityGroupId(secgroup01.securityGroupId),ec2.Port.tcp(3306));
        //ログローテーション用のIAM Role作成
        // const LogsRetentionRole = new iam.Role(this, 'LogsRetentionRole', {
        //   roleName: `${context.AWSENV}-to2go-CloudWatch-LogsRetentionRole`,
        //   assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        // })
        // const LogsRetentionPolicy = new iam.Policy(this, 'LogsRetentionpolicy', {
        //   statements:[ new iam.PolicyStatement( {
        //      effect: iam.Effect.ALLOW,
        //      actions: ['logs:DeleteRetentionPolicy', 'logs:PutRetentionPolicy', 'logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
        //      resources : ["*"],
        //      }),
        //   ],
        // })
        // LogsRetentionRole.attachInlinePolicy(LogsRetentionPolicy)
        //RDS作成
        const dbpw = ssm.StringParameter.valueFromLookup(this, '/to2go/DB_PASSWORD');
        // AuroraMysqlEngineVersion を動的に取得
        const auroraMysqlEngineVersion = rds.AuroraMysqlEngineVersion[context.RDSVER]; //https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_rds.AuroraMysqlEngineVersion.htmlより指定
        if (!auroraMysqlEngineVersion) {
            throw new Error(`Invalid Aurora MySQL version: ${context.RDSVER}`);
        }
        //開発/STG環境用RDS作成(リードレプリカ無し)
        if (envKey === "dev" || envKey === "stg") {
            const cluster = new rds.DatabaseCluster(this, `${context.AWSENV}-to2go-app-rds-aurora`, {
                engine: rds.DatabaseClusterEngine.auroraMysql({
                    version: auroraMysqlEngineVersion
                }),
                vpc: vpc,
                securityGroups: [secgroup01],
                vpcSubnets: {
                    subnets: private_subnet,
                },
                credentials: {
                    username: 'admin',
                    password: aws_cdk_lib_1.SecretValue.unsafePlainText(dbpw)
                },
                clusterIdentifier: `${context.AWSENV}-to2go-app-rds-cluster`,
                backup: {
                    retention: aws_cdk_lib_1.Duration.days(3), //30
                },
                defaultDatabaseName: 'app_development',
                writer: rds.ClusterInstance.provisioned(`Instance1`, {
                    instanceType: context.RDSTYPE,
                    isFromLegacyInstanceProps: true,
                    instanceIdentifier: `${context.AWSENV}-to2go-app-rds-instance1`,
                }),
                parameters: {
                    slow_query_log: '1',
                    general_log: '1',
                    long_query_time: '3',
                    log_output: 'FILE',
                    server_audit_logging: '1',
                    server_audit_events: 'CONNECT,QUERY'
                },
                cloudwatchLogsExports: ['error', 'general', 'slowquery', 'audit'],
                cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
                // cloudwatchLogsRetentionRole: LogsRetentionRole,
                storageEncrypted: true,
                deletionProtection: false,
                iamAuthentication: true,
                preferredMaintenanceWindow: 'Sat:16:00-Sat:16:30',
                removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
                subnetGroup: subnetGroup,
                monitoringInterval: cdk.Duration.minutes(1)
            });
            //RDS用のSecurityGroupにQuickSightからのIngressルール追加
            // cluster.connections.allowFrom(secgroup02, ec2.Port.tcp(3306))
        }
        ;
        //本番環境用RDS作成(リードレプリカ有り)
        // if (envKey === "prod") {
        // const cluster = new rds.DatabaseCluster(this, `${context.AWSENV}-to2go-app-rds-aurora`, {
        // engine: rds.DatabaseClusterEngine.auroraMysql({
        //   version: auroraMysqlEngineVersion
        // }),
        // vpc: vpc,
        // securityGroups: [secgroup01],
        // vpcSubnets: {
        //     subnets: private_subnet,
        // },
        // credentials: {
        //   username: 'to2goadmin',
        //   password : SecretValue.unsafePlainText(dbpw)
        // },
        // clusterIdentifier: `${context.AWSENV}-to2go-app-rds-cluster`,
        // backup: {
        //   retention: Duration.days(3),//30
        // },
        // defaultDatabaseName: 'to2go',
        // writer: rds.ClusterInstance.provisioned(`Instance1`, {
        //   instanceType: context.RDSTYPE,
        //   isFromLegacyInstanceProps: true,
        //   instanceIdentifier: `${context.AWSENV}-to2go-app-rds-instance1`,
        // }),
        // readers: [
        //   rds.ClusterInstance.provisioned(`${context.AWSENV}-to2go-app-rds-readreplica1`, {
        //     instanceType: context.RDSTYPE,
        //     isFromLegacyInstanceProps: true,
        //     instanceIdentifier: `${context.AWSENV}-to2go-app-rds-readreplica1`,
        //   }),
        // ],
        // parameters: {
        //   slow_query_log: '1',
        //   general_log: '1',
        //   long_query_time: '3',
        //   log_output: 'FILE',
        //   server_audit_logging: '1',
        //   server_audit_events: 'CONNECT,QUERY'
        // },
        // cloudwatchLogsExports:['error','general','slowquery','audit'],
        // cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
        // cloudwatchLogsRetentionRole: LogsRetentionRole,
        // storageEncrypted: true,
        // deletionProtection: false,
        // iamAuthentication: true,
        // preferredMaintenanceWindow: 'Sat:16:00-Sat:16:30',
        // removalPolicy: RemovalPolicy.DESTROY,
        // subnetGroup: subnetGroup,
        // monitoringInterval: cdk.Duration.minutes(1)
        // })
        //RDS用のSecurityGroupにQuickSightからのIngressルール追加
        // cluster.connections.allowFrom(secgroup02, ec2.Port.tcp(3306))
        // };
    }
}
exports.RdsStack = RdsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmRzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmRzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQUFvRjtBQUVwRixpREFBa0Q7QUFDbEQsMkNBQTJDO0FBQzNDLDJDQUEyQztBQUMzQyx3Q0FBd0M7QUFDeEMsMkNBQTJDO0FBQzNDLDZDQUE2QztBQUM3Qyw4Q0FBOEM7QUFFOUMsTUFBYSxRQUFTLFNBQVEsbUJBQUs7SUFDakMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFpQjtRQUN6RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixNQUFNLFVBQVUsR0FBRyxhQUFhLENBQUM7UUFDakMsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDakQsSUFBSSxNQUFNLElBQUksU0FBUztZQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLHFFQUFxRSxVQUFVLE1BQU0sQ0FBQyxDQUFDO1FBQzNHLE1BQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQzlDLElBQUksT0FBTyxJQUFJLFNBQVM7WUFBRSxNQUFNLElBQUksS0FBSyxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFFcEUsUUFBUTtRQUNSLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxRQUFRLEVBQUU7WUFDN0MsT0FBTyxFQUFFLEdBQUcsT0FBTyxDQUFDLE1BQU0sZ0JBQWdCO1NBQzNDLENBQUMsQ0FBQztRQUVILFVBQVU7UUFDVixNQUFNLGNBQWMsR0FBRyxHQUFHLENBQUMsYUFBYSxDQUFDO1lBQ3ZDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLG1CQUFtQjtTQUMvQyxDQUFDLENBQUMsT0FBTyxDQUFBO1FBRVYsZUFB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cUU7UUFDckUsTUFBTTtRQUNOLGFBQWE7UUFDYixzRkFBc0Y7UUFDdEYscUNBQXFDO1FBQ3JDLHVDQUF1QztRQUN2QywwRUFBMEU7UUFDMUUsUUFBUTtRQUNSLEtBQUs7UUFDTCxnQkFBZ0I7UUFDaEIseUJBQXlCO1FBQ3pCLHNCQUFzQjtRQUN0QiwwQkFBMEI7UUFDMUIsd0JBQXdCO1FBQ3hCLCtCQUErQjtRQUMvQix5Q0FBeUM7UUFDekMsS0FBSztRQUNMLGlFQUFpRTtRQUNqRSx5REFBeUQ7UUFDekQsa0RBQWtEO1FBQ2xELDBCQUEwQjtRQUMxQiw2QkFBNkI7UUFDN0IsMkJBQTJCO1FBQzNCLHFEQUFxRDtRQUNyRCx3Q0FBd0M7UUFDeEMsNEJBQTRCO1FBQzVCLDhDQUE4QztRQUNoRCxLQUFLO1FBQ0wsOENBQThDO1FBQzlDLGdFQUFnRTtRQUNoRSxLQUFLO0lBQ1AsQ0FBQztDQUNGO0FBdkxELDRCQXVMQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7RHVyYXRpb24sIFJlbW92YWxQb2xpY3ksIFNlY3JldFZhbHVlLCBTdGFjaywgU3RhY2tQcm9wc30gZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQge1NlY3VyaXR5R3JvdXB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgcmRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yZHMnO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliL2NvcmUnO1xuaW1wb3J0ICogYXMgc3NtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zc20nO1xuaW1wb3J0ICogYXMgbG9ncyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtbG9ncyc7XG4vLyBpbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5cbmV4cG9ydCBjbGFzcyBSZHNTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIGNvbnN0IGFyZ0NvbnRleHQgPSAnZW52aXJvbm1lbnQnO1xuICAgIGNvbnN0IGVudktleSA9IHRoaXMubm9kZS50cnlHZXRDb250ZXh0KGFyZ0NvbnRleHQpO1xuICAgICAgaWYgKGVudktleSA9PSB1bmRlZmluZWQpXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgUGxlYXNlIHNwZWNpZnkgZW52aXJvbm1lbnQgd2l0aCBjb250ZXh0IG9wdGlvbi4gZXgpIGNkayBkZXBsb3kgLWMgJHthcmdDb250ZXh0fT1zdGdgKTtcbiAgICBjb25zdCBjb250ZXh0ID0gdGhpcy5ub2RlLnRyeUdldENvbnRleHQoZW52S2V5KTtcbiAgICAgIGlmIChjb250ZXh0ID09IHVuZGVmaW5lZCkgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGVudmlyb25tZW50LicpO1xuXG4gICAgLy9WUEPlj5blvpfjgIBcbiAgICBjb25zdCB2cGMgPSBlYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ1ZQQ2FwcCcsIHtcbiAgICAgIHZwY05hbWU6IGAke2NvbnRleHQuQVdTRU5WfS10bzJnby1hcHAtdnBjYCxcbiAgICB9KTtcblxuICAgIC8vU3VibmV05Y+W5b6XXG4gICAgY29uc3QgcHJpdmF0ZV9zdWJuZXQgPSB2cGMuc2VsZWN0U3VibmV0cyh7XG4gICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgIH0pLnN1Ym5ldHNcblxuICAgIC8vU3VibmV0R3JvdXDkvZzmiJBcbiAgICBjb25zdCBzdWJuZXRHcm91cCA9IG5ldyByZHMuU3VibmV0R3JvdXAodGhpcywgYCR7Y29udGV4dC5BV1NFTlZ9LXRvMmdvLWFwcC1yZHMtc3VibmV0Z3JvdXBgLCB7XG4gICAgICBkZXNjcmlwdGlvbjogJ2F1cm9yYSBzdWJuZXQgZ3JvdXAnLFxuICAgICAgdnBjOiB2cGMsXG4gICAgICB2cGNTdWJuZXRzOiB7XG4gICAgICAgIHN1Ym5ldHM6IHByaXZhdGVfc3VibmV0LFxuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy9SRFPnlKjjga5TZWN1cml0eUdyb3Vw5L2c5oiQXG4gICAgY29uc3Qgc2VjZ3JvdXAwMSA9IG5ldyBTZWN1cml0eUdyb3VwKHRoaXMsIGAke2NvbnRleHQuQVdTRU5WfS10bzJnby1hcHAtcmRzLXNlY3VyaXR5Z3JvdXBgLCB7XG4gICAgICB2cGM6IHZwYyxcbiAgICAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tYXBwLXJkcy1zZWN1cml0eWdyb3VwYCxcbiAgICB9KTtcblxuICAgIC8vUXVpY2tTaWdodOeUqOOBrlNlY3VyaXR5R3JvdXDkvZzmiJBcbiAgICAvLyBjb25zdCBzZWNncm91cDAyID0gbmV3IFNlY3VyaXR5R3JvdXAodGhpcywgYCR7Y29udGV4dC5BV1NFTlZ9LXRvMmdvLXF1aWNrc2lnaHQtZW5pLXNlY3VyaXR5Z3JvdXBgLCB7XG4gICAgLy8gICB2cGM6IHZwYyxcbiAgICAvLyAgIHNlY3VyaXR5R3JvdXBOYW1lOiBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tcXVpY2tzaWdodC1lbmktc2VjdXJpdHlncm91cGAsXG4gICAgLy8gICBhbGxvd0FsbE91dGJvdW5kOiBmYWxzZVxuICAgIC8vIH0pO1xuXG4gICAgLy9SRFPnlKjjga5TZWN1cml0eUdyb3Vw44GrRmFyZ2F0ZeOBi+OCieOBrkluZ3Jlc3Pjg6vjg7zjg6vov73liqBcbiAgICAvLyBjb25zdCBvbmxpbmVzZ0lkID0gY2RrLkZuLmltcG9ydFZhbHVlKCdvbmxpbmUtc2ctSWQnKTsgLy/jgZPjgpPjgarlvaLjgadTR+OCkmltcG9ydOOBmeOCi1xuICAgIC8vIGNvbnN0IGJhdGNoc2dJZCA9IGNkay5Gbi5pbXBvcnRWYWx1ZSgnYmF0Y2gtc2ctSWQnKTtcblxuICAgIHNlY2dyb3VwMDEuYWRkSW5ncmVzc1J1bGUoZWMyLlBlZXIuaXB2NCgnMTAuMzAuMC4wLzE2JyksIGVjMi5Qb3J0LnRjcCgzMzA2KSk7XG4gICAgLy8gc2VjZ3JvdXAwMS5hZGRJbmdyZXNzUnVsZShlYzIuUGVlci5zZWN1cml0eUdyb3VwSWQoYmF0Y2hzZ0lkKSxlYzIuUG9ydC50Y3AoMzMwNikpO1xuXG4gICAgLy9RdWlja1NpZ2h055So44GuU2VjdXJpdHlHcm91cOOBq1JEU+OBi+OCieOBrkluZ3Jlc3MvRWdyZXNz44Or44O844Or6L+95YqgXG4gICAgLy8gc2VjZ3JvdXAwMi5hZGRJbmdyZXNzUnVsZShlYzIuUGVlci5zZWN1cml0eUdyb3VwSWQoc2VjZ3JvdXAwMS5zZWN1cml0eUdyb3VwSWQpLGVjMi5Qb3J0LmFsbFRjcCgpKTtcbiAgICAvLyBzZWNncm91cDAyLmFkZEVncmVzc1J1bGUoZWMyLlBlZXIuc2VjdXJpdHlHcm91cElkKHNlY2dyb3VwMDEuc2VjdXJpdHlHcm91cElkKSxlYzIuUG9ydC50Y3AoMzMwNikpO1xuXG4gICAgLy/jg63jgrDjg63jg7zjg4bjg7zjgrfjg6fjg7PnlKjjga5JQU0gUm9sZeS9nOaIkFxuICAgIC8vIGNvbnN0IExvZ3NSZXRlbnRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsICdMb2dzUmV0ZW50aW9uUm9sZScsIHtcbiAgICAvLyAgIHJvbGVOYW1lOiBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tQ2xvdWRXYXRjaC1Mb2dzUmV0ZW50aW9uUm9sZWAsXG4gICAgLy8gICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAvLyB9KVxuXG4gICAgLy8gY29uc3QgTG9nc1JldGVudGlvblBvbGljeSA9IG5ldyBpYW0uUG9saWN5KHRoaXMsICdMb2dzUmV0ZW50aW9ucG9saWN5Jywge1xuICAgIC8vICAgc3RhdGVtZW50czpbIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KCB7XG4gICAgLy8gICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgLy8gICAgICBhY3Rpb25zOiBbJ2xvZ3M6RGVsZXRlUmV0ZW50aW9uUG9saWN5JywgJ2xvZ3M6UHV0UmV0ZW50aW9uUG9saWN5JywgJ2xvZ3M6Q3JlYXRlTG9nR3JvdXAnLCAnbG9nczpDcmVhdGVMb2dTdHJlYW0nLCAnbG9nczpQdXRMb2dFdmVudHMnXSxcbiAgICAvLyAgICAgIHJlc291cmNlcyA6IFtcIipcIl0sXG4gICAgLy8gICAgICB9KSxcbiAgICAvLyAgIF0sXG4gICAgLy8gfSlcblxuICAgIC8vIExvZ3NSZXRlbnRpb25Sb2xlLmF0dGFjaElubGluZVBvbGljeShMb2dzUmV0ZW50aW9uUG9saWN5KVxuXG4gICAgLy9SRFPkvZzmiJBcbiAgICBjb25zdCBkYnB3ID0gc3NtLlN0cmluZ1BhcmFtZXRlci52YWx1ZUZyb21Mb29rdXAodGhpcywgJy90bzJnby9EQl9QQVNTV09SRCcpXG5cbiAgICAvLyBBdXJvcmFNeXNxbEVuZ2luZVZlcnNpb24g44KS5YuV55qE44Gr5Y+W5b6XXG4gICAgY29uc3QgYXVyb3JhTXlzcWxFbmdpbmVWZXJzaW9uID0gKHJkcy5BdXJvcmFNeXNxbEVuZ2luZVZlcnNpb24gYXMgYW55KVtjb250ZXh0LlJEU1ZFUl07IC8vaHR0cHM6Ly9kb2NzLmF3cy5hbWF6b24uY29tL2Nkay9hcGkvdjIvZG9jcy9hd3MtY2RrLWxpYi5hd3NfcmRzLkF1cm9yYU15c3FsRW5naW5lVmVyc2lvbi5odG1s44KI44KK5oyH5a6aXG4gICAgaWYgKCFhdXJvcmFNeXNxbEVuZ2luZVZlcnNpb24pIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBBdXJvcmEgTXlTUUwgdmVyc2lvbjogJHtjb250ZXh0LlJEU1ZFUn1gKTtcbiAgICB9XG5cbiAgICAvL+mWi+eZui9TVEfnkrDlooPnlKhSRFPkvZzmiJAo44Oq44O844OJ44Os44OX44Oq44Kr54Sh44GXKVxuICAgIGlmIChlbnZLZXkgPT09IFwiZGV2XCIgfHwgZW52S2V5ID09PSBcInN0Z1wiKSB7XG4gICAgICBjb25zdCBjbHVzdGVyID0gbmV3IHJkcy5EYXRhYmFzZUNsdXN0ZXIodGhpcywgYCR7Y29udGV4dC5BV1NFTlZ9LXRvMmdvLWFwcC1yZHMtYXVyb3JhYCwge1xuICAgICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhTXlzcWwoe1xuICAgICAgICAgIHZlcnNpb246IGF1cm9yYU15c3FsRW5naW5lVmVyc2lvblxuICAgICAgICB9KSxcbiAgICAgICAgdnBjOiB2cGMsXG4gICAgICAgIHNlY3VyaXR5R3JvdXBzOiBbc2VjZ3JvdXAwMV0sXG4gICAgICAgIHZwY1N1Ym5ldHM6IHtcbiAgICAgICAgICAgIHN1Ym5ldHM6IHByaXZhdGVfc3VibmV0LFxuICAgICAgICB9LFxuICAgICAgICBjcmVkZW50aWFsczoge1xuICAgICAgICAgIHVzZXJuYW1lOiAnYWRtaW4nLFxuICAgICAgICAgIHBhc3N3b3JkIDogU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KGRicHcpXG4gICAgICAgIH0sXG4gICAgICAgIGNsdXN0ZXJJZGVudGlmaWVyOiBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tYXBwLXJkcy1jbHVzdGVyYCxcbiAgICAgICAgYmFja3VwOiB7XG4gICAgICAgICAgcmV0ZW50aW9uOiBEdXJhdGlvbi5kYXlzKDMpLC8vMzBcbiAgICAgICAgfSxcbiAgICAgICAgZGVmYXVsdERhdGFiYXNlTmFtZTogJ2FwcF9kZXZlbG9wbWVudCcsXG4gICAgICAgIHdyaXRlcjogcmRzLkNsdXN0ZXJJbnN0YW5jZS5wcm92aXNpb25lZChgSW5zdGFuY2UxYCwge1xuICAgICAgICAgIGluc3RhbmNlVHlwZTogY29udGV4dC5SRFNUWVBFLFxuICAgICAgICAgIGlzRnJvbUxlZ2FjeUluc3RhbmNlUHJvcHM6IHRydWUsXG4gICAgICAgICAgaW5zdGFuY2VJZGVudGlmaWVyOiBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tYXBwLXJkcy1pbnN0YW5jZTFgLFxuICAgICAgICB9KSxcbiAgICAgICAgcGFyYW1ldGVyczoge1xuICAgICAgICAgIHNsb3dfcXVlcnlfbG9nOiAnMScsXG4gICAgICAgICAgZ2VuZXJhbF9sb2c6ICcxJyxcbiAgICAgICAgICBsb25nX3F1ZXJ5X3RpbWU6ICczJyxcbiAgICAgICAgICBsb2dfb3V0cHV0OiAnRklMRScsXG4gICAgICAgICAgc2VydmVyX2F1ZGl0X2xvZ2dpbmc6ICcxJyxcbiAgICAgICAgICBzZXJ2ZXJfYXVkaXRfZXZlbnRzOiAnQ09OTkVDVCxRVUVSWSdcbiAgICAgICAgfSxcbiAgICAgICAgY2xvdWR3YXRjaExvZ3NFeHBvcnRzOlsnZXJyb3InLCdnZW5lcmFsJywnc2xvd3F1ZXJ5JywnYXVkaXQnXSxcbiAgICAgICAgY2xvdWR3YXRjaExvZ3NSZXRlbnRpb246IGxvZ3MuUmV0ZW50aW9uRGF5cy5PTkVfTU9OVEgsXG4gICAgICAgIC8vIGNsb3Vkd2F0Y2hMb2dzUmV0ZW50aW9uUm9sZTogTG9nc1JldGVudGlvblJvbGUsXG4gICAgICAgIHN0b3JhZ2VFbmNyeXB0ZWQ6IHRydWUsXG4gICAgICAgIGRlbGV0aW9uUHJvdGVjdGlvbjogZmFsc2UsXG4gICAgICAgIGlhbUF1dGhlbnRpY2F0aW9uOiB0cnVlLFxuICAgICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogJ1NhdDoxNjowMC1TYXQ6MTY6MzAnLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAgIHN1Ym5ldEdyb3VwOiBzdWJuZXRHcm91cCxcbiAgICAgICAgbW9uaXRvcmluZ0ludGVydmFsOiBjZGsuRHVyYXRpb24ubWludXRlcygxKVxuICAgICAgfSlcbiAgICAgIC8vUkRT55So44GuU2VjdXJpdHlHcm91cOOBq1F1aWNrU2lnaHTjgYvjgonjga5JbmdyZXNz44Or44O844Or6L+95YqgXG4gICAgICAvLyBjbHVzdGVyLmNvbm5lY3Rpb25zLmFsbG93RnJvbShzZWNncm91cDAyLCBlYzIuUG9ydC50Y3AoMzMwNikpXG4gICAgfTtcblxuICAgIC8v5pys55Wq55Kw5aKD55SoUkRT5L2c5oiQKOODquODvOODieODrOODl+ODquOCq+acieOCiilcbiAgICAvLyBpZiAoZW52S2V5ID09PSBcInByb2RcIikge1xuICAgIC8vIGNvbnN0IGNsdXN0ZXIgPSBuZXcgcmRzLkRhdGFiYXNlQ2x1c3Rlcih0aGlzLCBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tYXBwLXJkcy1hdXJvcmFgLCB7XG4gICAgICAvLyBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhTXlzcWwoe1xuICAgICAgLy8gICB2ZXJzaW9uOiBhdXJvcmFNeXNxbEVuZ2luZVZlcnNpb25cbiAgICAgIC8vIH0pLFxuICAgICAgLy8gdnBjOiB2cGMsXG4gICAgICAvLyBzZWN1cml0eUdyb3VwczogW3NlY2dyb3VwMDFdLFxuICAgICAgLy8gdnBjU3VibmV0czoge1xuICAgICAgLy8gICAgIHN1Ym5ldHM6IHByaXZhdGVfc3VibmV0LFxuICAgICAgLy8gfSxcbiAgICAgIC8vIGNyZWRlbnRpYWxzOiB7XG4gICAgICAvLyAgIHVzZXJuYW1lOiAndG8yZ29hZG1pbicsXG4gICAgICAvLyAgIHBhc3N3b3JkIDogU2VjcmV0VmFsdWUudW5zYWZlUGxhaW5UZXh0KGRicHcpXG4gICAgICAvLyB9LFxuICAgICAgLy8gY2x1c3RlcklkZW50aWZpZXI6IGAke2NvbnRleHQuQVdTRU5WfS10bzJnby1hcHAtcmRzLWNsdXN0ZXJgLFxuICAgICAgLy8gYmFja3VwOiB7XG4gICAgICAvLyAgIHJldGVudGlvbjogRHVyYXRpb24uZGF5cygzKSwvLzMwXG4gICAgICAvLyB9LFxuICAgICAgLy8gZGVmYXVsdERhdGFiYXNlTmFtZTogJ3RvMmdvJyxcbiAgICAgIC8vIHdyaXRlcjogcmRzLkNsdXN0ZXJJbnN0YW5jZS5wcm92aXNpb25lZChgSW5zdGFuY2UxYCwge1xuICAgICAgLy8gICBpbnN0YW5jZVR5cGU6IGNvbnRleHQuUkRTVFlQRSxcbiAgICAgIC8vICAgaXNGcm9tTGVnYWN5SW5zdGFuY2VQcm9wczogdHJ1ZSxcbiAgICAgIC8vICAgaW5zdGFuY2VJZGVudGlmaWVyOiBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tYXBwLXJkcy1pbnN0YW5jZTFgLFxuICAgICAgLy8gfSksXG4gICAgICAvLyByZWFkZXJzOiBbXG4gICAgICAvLyAgIHJkcy5DbHVzdGVySW5zdGFuY2UucHJvdmlzaW9uZWQoYCR7Y29udGV4dC5BV1NFTlZ9LXRvMmdvLWFwcC1yZHMtcmVhZHJlcGxpY2ExYCwge1xuICAgICAgLy8gICAgIGluc3RhbmNlVHlwZTogY29udGV4dC5SRFNUWVBFLFxuICAgICAgLy8gICAgIGlzRnJvbUxlZ2FjeUluc3RhbmNlUHJvcHM6IHRydWUsXG4gICAgICAvLyAgICAgaW5zdGFuY2VJZGVudGlmaWVyOiBgJHtjb250ZXh0LkFXU0VOVn0tdG8yZ28tYXBwLXJkcy1yZWFkcmVwbGljYTFgLFxuICAgICAgLy8gICB9KSxcbiAgICAgIC8vIF0sXG4gICAgICAvLyBwYXJhbWV0ZXJzOiB7XG4gICAgICAvLyAgIHNsb3dfcXVlcnlfbG9nOiAnMScsXG4gICAgICAvLyAgIGdlbmVyYWxfbG9nOiAnMScsXG4gICAgICAvLyAgIGxvbmdfcXVlcnlfdGltZTogJzMnLFxuICAgICAgLy8gICBsb2dfb3V0cHV0OiAnRklMRScsXG4gICAgICAvLyAgIHNlcnZlcl9hdWRpdF9sb2dnaW5nOiAnMScsXG4gICAgICAvLyAgIHNlcnZlcl9hdWRpdF9ldmVudHM6ICdDT05ORUNULFFVRVJZJ1xuICAgICAgLy8gfSxcbiAgICAgIC8vIGNsb3Vkd2F0Y2hMb2dzRXhwb3J0czpbJ2Vycm9yJywnZ2VuZXJhbCcsJ3Nsb3dxdWVyeScsJ2F1ZGl0J10sXG4gICAgICAvLyBjbG91ZHdhdGNoTG9nc1JldGVudGlvbjogbG9ncy5SZXRlbnRpb25EYXlzLk9ORV9NT05USCxcbiAgICAgIC8vIGNsb3Vkd2F0Y2hMb2dzUmV0ZW50aW9uUm9sZTogTG9nc1JldGVudGlvblJvbGUsXG4gICAgICAvLyBzdG9yYWdlRW5jcnlwdGVkOiB0cnVlLFxuICAgICAgLy8gZGVsZXRpb25Qcm90ZWN0aW9uOiBmYWxzZSxcbiAgICAgIC8vIGlhbUF1dGhlbnRpY2F0aW9uOiB0cnVlLFxuICAgICAgLy8gcHJlZmVycmVkTWFpbnRlbmFuY2VXaW5kb3c6ICdTYXQ6MTY6MDAtU2F0OjE2OjMwJyxcbiAgICAgIC8vIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIC8vIHN1Ym5ldEdyb3VwOiBzdWJuZXRHcm91cCxcbiAgICAgIC8vIG1vbml0b3JpbmdJbnRlcnZhbDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoMSlcbiAgICAvLyB9KVxuICAgIC8vUkRT55So44GuU2VjdXJpdHlHcm91cOOBq1F1aWNrU2lnaHTjgYvjgonjga5JbmdyZXNz44Or44O844Or6L+95YqgXG4gICAgLy8gY2x1c3Rlci5jb25uZWN0aW9ucy5hbGxvd0Zyb20oc2VjZ3JvdXAwMiwgZWMyLlBvcnQudGNwKDMzMDYpKVxuICAgIC8vIH07XG4gIH1cbn1cbiJdfQ==