import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';

export class CdkLcStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // cdk deploy 하기 전에!
    // packer로 두 번째 ami 만들어두기

    // 기존 vpc 가져오기
    const vpc = ec2.Vpc.fromLookup(this, 'lan-cicd-existing-vpc', {
      isDefault: false,
      vpcId: 'vpc-00d95ee34bb206fcd'
    });

    // asg 보안그룹 가져오기
    const lanCicdExistingAsgSg = ec2.SecurityGroup.fromLookupByName(this, 'lan-cicd-existing-asg-sg', 'lan-cicd-asg-sg', vpc)

    // asg 두 번째 ami 가져오기  
    const secondAmi = new ec2.LookupMachineImage({
      name: 'lan-cicd-ami',
    })

    // lc 필요 없음. asg 옵션에 넣어서 만들면 됨
    const secondASG = new autoscaling.AutoScalingGroup(this, 'lan-cicd-second-asg', {
      vpc,
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      machineImage: secondAmi,
      securityGroup: lanCicdExistingAsgSg,
      autoScalingGroupName: 'lan-cicd-second-asg',
      desiredCapacity: 1,
      maxCapacity: 3,
      minCapacity: 1,
      groupMetrics: [autoscaling.GroupMetrics.all()],
      keyName: 'lanKeyPair'
    });
    secondASG.scaleOnCpuUtilization('KeepSpareCPU', {
      targetUtilizationPercent: 50
    });

    // 기존 alb의 리스너에 신규 asg 붙이고 기존 asg 삭제하기
    const existingAlb = elbv2.ApplicationLoadBalancer.fromLookup(this, 'lan-cicd-existing-alb', {
      loadBalancerTags: {
        name: 'lan-cicd-alb'  // 기존 infra에서 tag 'name' 추가해주지 않으면 작동 안 함. 왜?
      }      
    }); 
    const secondListener = existingAlb.addListener('lan-cicd-second-listener', {
      port: 8080, // 여기 바뀜
      open: true,
    });    
    secondListener.addTargets('lan-ami-test-new-target-group', {  
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      protocolVersion: elbv2.ApplicationProtocolVersion.HTTP1,
      targetGroupName: 'lan-alb-second-tg',   // tag 텝에서 Name으로 적용됐는지 확인해야 !!!!
      targets: [secondASG]
    });




  }
}
