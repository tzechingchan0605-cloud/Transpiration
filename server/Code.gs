// Deploy from a PRIVATE Google Sheet owned by tzechingchan0605@gmail.com.
const TEACHER_EMAIL = 'tzechingchan0605@gmail.com';
const MODULE_ID = 'VL_BIO_TRANSPIRATION';
function setupCentralStore() {
  const props=PropertiesService.getScriptProperties();
  if(!props.getProperty('SHEET_ID'))props.setProperty('SHEET_ID',SpreadsheetApp.getActiveSpreadsheet().getId());
  if(!props.getProperty('FOLDER_ID'))props.setProperty('FOLDER_ID',DriveApp.createFolder('VL2 private student records').getId());
  if(!props.getProperty('TEACHER_KEY'))props.setProperty('TEACHER_KEY',Utilities.getUuid()+Utilities.getUuid());
  const book=SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  if(!book.getSheetByName('Records'))book.insertSheet('Records').appendRow(['Attempt ID','Saved at','Name','Class','Email','Status','Private file ID','Write token hash']);
  // View this key in Script Properties; never put it in public website code.
}
function jsonResponse(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function tokenHash(token){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,token).map(x=>('0'+((x+256)%256).toString(16)).slice(-2)).join('');}
function doPost(event){
  let lock;
  try{
    if(!event.postData||event.postData.contents.length>12*1024*1024)throw Error('Invalid request size');
    const body=JSON.parse(event.postData.contents),props=PropertiesService.getScriptProperties();
    if(!props.getProperty('SHEET_ID')||!props.getProperty('TEACHER_KEY'))throw Error('Service not configured');
    const sheet=SpreadsheetApp.openById(props.getProperty('SHEET_ID')).getSheetByName('Records');
    if(body.action==='list'){
      if(body.teacherKey!==props.getProperty('TEACHER_KEY'))throw Error('Teacher access denied');
      const count=sheet.getLastRow()-1,cursor=Number(body.cursor||0);
      if(!Number.isInteger(cursor)||cursor<0||cursor>count)throw Error('Invalid cursor');
      const take=Math.min(20,count-cursor);
      const records=take?sheet.getRange(cursor+2,7,take,1).getValues().map(row=>JSON.parse(DriveApp.getFileById(row[0]).getBlob().getDataAsString())):[];
      return jsonResponse({ok:true,records,nextCursor:cursor+take<count?cursor+take:null});
    }
    if(body.action!=='save')throw Error('Unknown action');
    const r=body.record;
    if(!r||r.moduleId!==MODULE_ID||r.schemaVersion!==1||!/^[-a-zA-Z0-9]{1,99}$/.test(r.id)||!r.profile||typeof r.profile.email!=='string'||!r.profile.name||!r.profile.classInfo||!r.form||!r.events||!r.setup||!Number.isFinite(Date.parse(r.savedAt)))throw Error('Invalid student record');
    if(r.profile.email.trim().toLowerCase()===TEACHER_EMAIL)throw Error('Teacher demonstrations are excluded');
    if(typeof body.token!=='string'||body.token.length<32||body.token.length>200)throw Error('Invalid write token');
    lock=LockService.getScriptLock();lock.waitLock(20000);
    const rows=sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,8).getValues():[];
    const index=rows.findIndex(row=>row[0]===r.id),hash=tokenHash(body.token);
    let file;
    if(index>=0){
      if(rows[index][7]!==hash)throw Error('Attempt access denied');
      if(Date.parse(rows[index][1])>=Date.parse(r.savedAt))return jsonResponse({ok:true,id:r.id});
      file=DriveApp.getFileById(rows[index][6]);file.setContent(JSON.stringify(r));
    }else{
      file=DriveApp.getFolderById(props.getProperty('FOLDER_ID')).createFile(r.id+'.json',JSON.stringify(r),MimeType.PLAIN_TEXT);
    }
    // Rich answers/images remain in private Drive files, avoiding Sheet cell limits.
    // Prefix user strings so spreadsheet formulas cannot execute.
    const safe=value=>"'"+String(value||'');
    const row=[r.id,r.savedAt,safe(r.profile.name),safe(r.profile.classInfo),safe(r.profile.email),r.reflectionSubmittedAt?'Complete':r.submitted?'Reflection pending':'In progress',file.getId(),hash];
    sheet.getRange(index>=0?index+2:sheet.getLastRow()+1,1,1,8).setValues([row]);
    return jsonResponse({ok:true,id:r.id});
  }catch(error){return jsonResponse({ok:false,error:String(error.message||error)});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}
