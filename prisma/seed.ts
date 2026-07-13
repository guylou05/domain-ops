import { PrismaClient, Role } from '@prisma/client';
import { hash } from 'bcryptjs';
const prisma = new PrismaClient();
async function main(){
  const passwordHash = await hash('demo-password', 10);
  const admin = await prisma.user.upsert({where:{email:'admin@domainscout.demo'},update:{},create:{email:'admin@domainscout.demo',name:'Demo Admin',passwordHash,role:Role.ADMIN}});
  const user = await prisma.user.upsert({where:{email:'investor@domainscout.demo'},update:{},create:{email:'investor@domainscout.demo',name:'Demo Investor',passwordHash,role:Role.OWNER}});
  const workspace = await prisma.workspace.upsert({where:{slug:'demo-domain-portfolio'},update:{},create:{name:'Demo Domain Portfolio',slug:'demo-domain-portfolio',members:{create:[{userId:admin.id,role:Role.ADMIN},{userId:user.id,role:Role.OWNER}]}}});
  await prisma.plan.upsert({where:{name:'Professional'},update:{},create:{name:'Professional',priceCents:9900,entitlements:{create:[{key:'domain_checks',limit:5000},{key:'buyer_research',enabled:true}]}}});
  const names = ['aiautomationhub.com','workflowpilot.ai','revenueforge.com','agentloop.io','saassignal.com','austinpros.com'];
  for (const [i,name] of names.entries()) {
    const domain = await prisma.domain.upsert({where:{workspaceId_name:{workspaceId:workspace.id,name}},update:{},create:{workspaceId:workspace.id,createdById:user.id,name,tld:name.slice(name.lastIndexOf('.')),source:'DEMONSTRATION_SEED'}});
    await prisma.domainCheck.create({data:{domainId:domain.id,available:i%4!==0,registrationPrice:12+i*4,renewalPrice:15+i,premium:i===1,registrar:'MockRegistrar',status:'FRESH'}});
    await prisma.domainOpportunity.upsert({where:{domainId:domain.id},update:{},create:{workspaceId:workspace.id,domainId:domain.id,score:72+i*3,riskLevel:i===0?'MODERATE':'LOW',estimatedRetailMin:1800+i*300,estimatedRetailMax:6500+i*900,buyerCount:8+i,status:'ACTIVE',notes:'Demonstration data only.'}});
  }
  await prisma.watchlist.create({data:{workspaceId:workspace.id,name:'AI domains under $50',notes:'Demonstration watchlist for Phase 1.'}});
  await prisma.backgroundJob.create({data:{workspaceId:workspace.id,type:'daily_opportunity_digest',status:'COMPLETED',progress:100,payload:{demo:true}}});
}
main().finally(()=>prisma.$disconnect());
