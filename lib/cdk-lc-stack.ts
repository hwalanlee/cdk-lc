import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

export class CdkLcStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 기존 vpc 가져오기
    const vpc = ec2.Vpc.fromLookup(this, 'lan-existing-vpc', {
      isDefault: false,
      vpcId: 'vpc-013b9c65a8b7f708f'
    });

    // security group 만들기
    const securityGroupForPublic = new ec2.SecurityGroup(this, 'lan-ami-test-security-group', {
      vpc,
      description: 'lan-ami-test-security-group'
    });
    securityGroupForPublic.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), 'Allow SSH Access 22 from internet');
    securityGroupForPublic.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), 'Allow SSH Access 80 from internet');
    securityGroupForPublic.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), 'Allow SSH Access 443 from internet');
    securityGroupForPublic.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(8080), 'Allow SSH Access 8080 from internet');

    // ami id 가져오기  
    const newAMI = new ec2.LookupMachineImage({
      name: 'ami-test',
    }).getImage(this).imageId;

    // lc 만들기
    const newLc = new autoscaling.CfnLaunchConfiguration(this, 'lan-ami-test-new-lc', {
      imageId: newAMI,
      instanceType: 't2.micro',
      // 밑에는 옵션
      associatePublicIpAddress: false,
      // blockDeviceMappings: [{
      //   deviceName: 'deviceName',
      // 
      // the properties below are optional
      //   ebs: {
      //     deleteOnTermination: false,
      //     encrypted: false,
      //     iops: 123,
      //     snapshotId: 'snapshotId',
      //     throughput: 123,
      //     volumeSize: 123,
      //     volumeType: 'volumeType',
      //   },
      //   noDevice: false,
      //   virtualName: 'virtualName',
      // }],
      // classicLinkVpcId: 'classicLinkVpcId',
      // classicLinkVpcSecurityGroups: ['classicLinkVpcSecurityGroups'],
      // ebsOptimized: false,
      // iamInstanceProfile: 'iamInstanceProfile',
      // instanceId: 'instanceId',
      instanceMonitoring: true, // default - false
      // kernelId: 'kernelId',
      keyName: 'lanKeyPair',
      launchConfigurationName: 'lan-ami-test-new-lc',
      // metadataOptions: {
      //   httpEndpoint: 'httpEndpoint',
      //   httpPutResponseHopLimit: 123,
      //   httpTokens: 'httpTokens',
      // },
      // placementTenancy: 'placementTenancy',
      // ramDiskId: 'ramDiskId',
      // securityGroups: ['security-group-for-public'],  // securityGroupForNodejenkinsPublic
      // spotPrice: 'spotPrice',
      // userData: 'userData',
    });

    const newASG = new autoscaling.AutoScalingGroup(this, 'lan-ami-test-new-asg', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: new ec2.AmazonLinuxImage(),
      securityGroup: securityGroupForPublic,
      autoScalingGroupName: 'lan-ami-test-new-asg',
      desiredCapacity: 1,
      groupMetrics: [autoscaling.GroupMetrics.all()],
      keyName: 'lanKeyPair',
      maxCapacity: 3,
      minCapacity: 1
    });
    newASG.scaleOnCpuUtilization('KeepSpareCPU', {
      targetUtilizationPercent: 50
    });

    // 기존 alb의 리스너에 신규 asg 붙이고 기존 asg 삭제하기
    const existingAlb = elbv2.ApplicationLoadBalancer.fromLookup(this, 'lan-ami-test-existing-alb', {
      loadBalancerTags: {
        name: 'lan2-nodejenkins-alb'  // 태그 추가해줘야 함
      }
    });
    const albListener = existingAlb.addListener('lan-ami-test-new-listener', {
      port: 8080, // 여기 바뀜
      open: true,
    });    
    albListener.addTargets('lan-ami-test-new-target-group', {  // addTargetGroups(), addAction()
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      protocolVersion: elbv2.ApplicationProtocolVersion.HTTP1,
      //targetGroupName: 'lan-alb-tg',
      targets: [newASG]
    });










    /* 기존 alb에 신규 타겟 그룹 생성해서 붙이기
const existingListener = elbv2.ApplicationListener.fromLookup(this, 'lan-ami-test-existing-listener', {
      loadBalancerTags: {
        name: 'lan2-nodejenkins-alb'
      }
    })
    const newTG = new elbv2.ApplicationTargetGroup(this, 'lan-ami-test-new-target-group', {
      targetType: elbv2.TargetType.INSTANCE,
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      protocolVersion: elbv2.ApplicationProtocolVersion.HTTP1,
      //targetGroupName: 'lan-alb-tg',
      targets: [newASG]
    });

    existingListener.addTargetGroups('lan-ami-test-new-target-groups', {
      targetGroups: [newTG]
    });

*/

    // asg, target group 삭제해야 함


  }
}
