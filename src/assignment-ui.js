export function initializeAssignmentUI(adapter) {
  const dialog=document.querySelector('#card-dialog'), localField=document.querySelector('#local-assignees-field'), cloudField=document.querySelector('#cloud-assignees-field'), options=document.querySelector('#cloud-assignees-options'), status=document.querySelector('#cloud-assignees-status'), uidInput=document.querySelector('#assignee-uids-input'), namesInput=document.querySelector('#assignees-input'), legacyInput=document.querySelector('#legacy-assignees-input');
  let session=null, cachedWorkspace='', members=[];
  const mode=()=>globalThis.FlowboardApp?.getMode?.() || {kind:'local'};
  const memberName=member=>member.displayName || member.emailLower || member.uid;
  const updateSelection=()=>{
    const checked=[...options.querySelectorAll('input:checked')];
    if (checked.length>8) { checked.at(-1).checked=false; status.textContent='Choose no more than eight workspace members.'; return; }
    uidInput.value=checked.map(input=>input.value).join(',');
    namesInput.value=checked.map(input=>members.find(member=>member.uid===input.value)).filter(Boolean).map(memberName).join(', ');
    uidInput.dataset.touched='true';
  };
  const render=async()=>{
    const active=mode(), cloud=['cloud','cloud-preview'].includes(active.kind);
    localField.hidden=cloud; cloudField.hidden=!cloud;
    if (!cloud || !dialog.open || !session) return;
    status.textContent='Loading workspace members...'; options.replaceChildren();
    try {
      if (cachedWorkspace!==active.id) { members=await adapter.listMembers(active.id); cachedWorkspace=active.id; }
      const selected=uidInput.value.split(',').filter(Boolean), current=new Set(members.map(member=>member.uid));
      const legacy=legacyInput.value.split(',').map(value=>value.trim()).filter(Boolean), former=selected.filter(uid=>!current.has(uid));
      [...members, ...former.map(uid=>({uid, displayName:'Former member', role:'removed'}))].forEach(member=>{
        const label=document.createElement('label'), input=document.createElement('input'), text=document.createElement('span');
        label.className='assignee-option'; input.type='checkbox'; input.value=member.uid; input.checked=selected.includes(member.uid); input.disabled=active.kind==='cloud-preview'; text.textContent=`${memberName(member)}${member.role ? ` (${member.role})` : ''}`;
        input.addEventListener('change', updateSelection); label.append(input,text); options.append(label);
      });
      if (legacy.length) status.textContent=`Legacy labels: ${legacy.join(', ')}. Select workspace members to map them.`;
      else if (former.length) status.textContent='This card includes a former member. Remove that assignment before changing other assignees.';
      else status.textContent=active.kind==='cloud-preview' ? 'Workspace assignments are read only.' : 'Choose up to eight workspace members.';
    } catch (error) { console.error('Flowboard assignment members failed to load.',error); status.textContent='Workspace members could not be loaded. Assignment changes are unavailable.'; }
  };
  new MutationObserver(()=>render()).observe(dialog,{attributes:true,attributeFilter:['open']});
  window.addEventListener('flowboard:cloud-preview-change',()=>{cachedWorkspace=''; members=[]; render();});
  return {setSession(next){session=next; if(!session){cachedWorkspace='';members=[];} render();}};
}
