// Source rows are data, never commands. No credentials or member data belong here.
const categories = {'VIP Customer':'vip',Customer:'customer',Student:'student','Staff/Employee':'staff',Guest:'guest'};
const months = {'1 Month':1,'3 Months':3,'6 Months':6,'1 Year':12};
const packages = {Gym:'gym','Swimming Pool Only':'pool'};
const discounts = {'Condo 50%':'condo-50','Student 20%':'student-20','Student 50%':'student-50'};
const text = value => value == null ? '' : String(value).trim();
const day = value => {
  if (!value) return null;
  const result = text(value).slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || new Date(result+'T00:00:00Z').toISOString().slice(0,10)!==result) throw new Error('Invalid source date: '+result);
  return result;
};
function calendarEnd(start,count) {
  const d=new Date(start+'T00:00:00Z'),target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+count+1,0));
  target.setUTCDate(Math.min(d.getUTCDate(),target.getUTCDate()));return target.toISOString().slice(0,10);
}

export function prepareMemberImport(workbook,{file,sha256,recordedDateIsStart=false}) {
  const batch='members-'+sha256.slice(0,16);
  const used=new Set(),bySourceCode=new Map(),byName=new Map();
  const canonical = code => /^G\d+$/.test(code) ? 'G'+String(Number(code.slice(1))).padStart(3,'0') : code;
  let guestMax=Math.max(0,...workbook.Members.map(r=>/^G\d+$/.test(text(r['Member ID']))?Number(text(r['Member ID']).slice(1)):0));
  const report={batch,sha256,file,recordedDateIsStart,counts:{},categoryCounts:{},blankIdRows:[],guestAdjustments:[],nameLinks:[],review:[],sameNameGroups:[]};
  const members=workbook.Members.map(r=>{
    const sourceCode=text(r['Member ID']),name=text(r.Name);
    if (!name) throw new Error('Blank name at Members row '+r._row);
    const category=categories[text(r.Category)] || (!text(r.Category)?'guest':null);
    if(!category)throw new Error('Unknown category at Members row '+r._row);
    const code=sourceCode?canonical(sourceCode):'G'+String(++guestMax).padStart(3,'0');
    const expected={vip:'VC',customer:'C',student:'S',staff:'E',guest:'G'}[category];
    if(!new RegExp('^'+expected+'[0-9]+$').test(code)||used.has(code))throw new Error('Conflicting member code at row '+r._row);
    used.add(code);
    const notes=[text(r.Notes)].filter(Boolean);
    if(!sourceCode){report.blankIdRows.push(r._row);notes.push('Source Member ID blank; assigned '+code+' as Guest per import instruction.');}
    if(!text(r.Category))notes.push('Source category blank; provisionally classified as Guest.');
    if(sourceCode!==code&&sourceCode){report.guestAdjustments.push({row:r._row,from:sourceCode,to:code});notes.push('Previous Guest ID: '+sourceCode+'.');}
    if(r.Age!=null)notes.push('Source age: '+text(r.Age)+' (date of birth not supplied; no birth date inferred).');
    if(typeof r.Phone==='number')notes.push('Source phone was numeric; saved as supplied. Any missing leading zero requires review.');
    const member={member_code:code,category_id:category,full_name:name,contact_phone:text(r.Phone)||null,student_id:text(r['Student ID'])||null,date_of_birth:null,record_origin:'import',aliases:sourceCode&&sourceCode!==code?[sourceCode]:[],notes,source_reference:{file,sha256,batch,sheet:'Members',row:r._row,original:r,member_info_rows:[],remark_only_records:[]}};
    if(sourceCode){if(bySourceCode.has(sourceCode))throw new Error('Duplicate source code');bySourceCode.set(sourceCode,member);}
    const key=name.normalize('NFC');(byName.get(key)||byName.set(key,[]).get(key)).push(member);
    report.categoryCounts[category]=(report.categoryCounts[category]||0)+1;
    return member;
  });
  for(const group of byName.values())if(group.length>1){report.sameNameGroups.push(group.map(m=>m.member_code));for(const m of group)m.notes.push('Same name also appears under '+group.filter(g=>g!==m).map(g=>g.member_code).join(', ')+'. Kept as separate people using source IDs.');}
  const memberships=[],training=[],outcomes=[];
  for(const r of workbook.Member_Info) {
    const sourceCode=text(r['Member ID']);let member=sourceCode?bySourceCode.get(sourceCode):null;
    let link='source_member_id';
    if(!sourceCode){const matches=byName.get(text(r.Name).normalize('NFC'))||[];if(matches.length!==1)throw new Error('Ambiguous missing-ID link at Member_Info row '+r._row);member=matches[0];link='unique_exact_workbook_profile_name';report.nameLinks.push({row:r._row,memberRow:member.source_reference.row,memberCode:member.member_code});}
    if(!member || text(r.Name).normalize('NFC')!==member.full_name.normalize('NFC'))throw new Error('Missing or conflicting identity at Member_Info row '+r._row);
    member.source_reference.member_info_rows.push(r._row);
    const type=text(r['Record Type']),recorded=day(r['Recorded Date']),expiry=day(r['Expiry Date']),note=text(r.Notes),voucher=text(r['Voucher No.'])||null;
    const source_reference={file,sha256,batch,sheet:'Member_Info',row:r._row,original:r,member_row:member.source_reference.row,link_method:link,recorded_date_is_start:recordedDateIsStart};
    const issues=[];
    const base={member_code:member.member_code,record_origin:'import',source_reference};
    let outcome='remark';
    if(['Membership','Legacy membership'].includes(type) && packages[text(r.Package)] && member.category_id!=='guest') {
      const duration=months[text(r.Plan)]||null;
      if(r.Plan&&!duration)issues.push('Unmapped plan: '+text(r.Plan));
      if(r.Discount&&!discounts[text(r.Discount)])issues.push('Unmapped discount: '+text(r.Discount));
      if(!recorded)issues.push('Start date missing.');
      else if(!recordedDateIsStart)issues.push('Recorded Date '+recorded+' is not confirmed as Start Date.');
      if(!expiry)issues.push('Expiry unknown; source notes retained; not recalculated.');
      if(!duration)issues.push('Plan/duration unknown.');
      if(recorded&&duration&&expiry&&calendarEnd(recorded,duration)!==expiry)issues.push('Plan/calendar end differs from source expiry '+expiry+'; source expiry retained.');
      memberships.push({...base,package_id:packages[text(r.Package)],plan_id:duration?'plan-'+duration:null,discount_id:discounts[text(r.Discount)]||null,start_date:recordedDateIsStart?recorded:null,duration_months:duration,source_end_date:expiry,calculated_end_date:null,voucher_reference:voucher,remark:[note,...issues].filter(Boolean).join('\n')});
      outcome='membership';
    } else if(['PT','Legacy PT'].includes(type) && [5,10,20,50].includes(Number(r['PT Sessions']))) {
      issues.push('Historical PT kept separate; related membership/start alignment not established.');
      if(!expiry)issues.push('PT expiry unknown; not recalculated.');
      if(!recordedDateIsStart&&recorded)issues.push('Recorded Date '+recorded+' is not confirmed as Start Date.');
      const sessions=Number(r['PT Sessions']);
      if(recorded&&expiry&&calendarEnd(recorded,({5:1,10:1,20:2,50:5})[sessions])!==expiry)issues.push('PT validity differs from current policy; source expiry retained.');
      training.push({...base,service_type:'pt',sessions,duration_months:null,start_date:recordedDateIsStart?recorded:null,end_date:expiry,remark:[voucher?'Voucher No.: '+voucher:'',note,...issues].filter(Boolean).join('\n')});
      outcome='training';
    } else {
      member.source_reference.remark_only_records.push(r);
      member.notes.push('[Member_Info row '+r._row+'] '+Object.entries(r).filter(([k,v])=>!['Name','Member ID','_row'].includes(k)&&v!=null&&v!=='').map(([k,v])=>k+': '+text(v)).join('; '));
      if(/Day Pass/.test(type))issues.push('Day-pass history retained as information only. Attendance will be imported separately. Unnamed companions are not new identified member profiles.');
      else issues.push('Historical '+type+' retained in member remark; no unsupported package created.');
    }
    if(note&&outcome!=='remark')member.notes.push('[Member_Info row '+r._row+'] '+note);
    if(issues.length){member.notes.push('[Review Member_Info row '+r._row+'] '+issues.join(' '));report.review.push({row:r._row,memberCode:member.member_code,issues});}
    outcomes.push({row:r._row,member_code:member.member_code,outcome});
  }
  for(const m of members){m.remark=m.notes.join('\n');delete m.notes;}
  if(new Set(outcomes.map(r=>r.row)).size!==workbook.Member_Info.length)throw new Error('Source reconciliation failed');
  report.counts={members:members.length,memberships:memberships.length,training:training.length,remarkOnly:outcomes.filter(r=>r.outcome==='remark').length,sourceInfo:outcomes.length,attendance:0};
  return {batch,sha256,file,members,memberships,training,outcomes,report};
}
