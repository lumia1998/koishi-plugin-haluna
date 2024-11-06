"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchObjectByPath = exports.CreateCallServiceCommand = exports.waitForAuth = exports.CheckUrl = void 0;
function CheckUrl(url) {
    let newUrl = url;
    newUrl = newUrl.replace(/\s/g, '');
    if (newUrl.endsWith('/')) {
        newUrl = newUrl.slice(0, -1);
    }
    if (newUrl.startsWith('http://')) {
        newUrl = newUrl.replace('http://', 'ws://');
    }
    if (newUrl.startsWith('https://')) {
        newUrl = newUrl.replace('https://', 'wss://');
    }
    if (!newUrl.startsWith('ws://') && !newUrl.startsWith('wss://')) {
        newUrl = 'ws://' + newUrl;
    }
    return newUrl;
}
exports.CheckUrl = CheckUrl;
async function waitForAuth(ws) {
    while (!ws.IsAuth()) {
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
exports.waitForAuth = waitForAuth;
function replacePlaceholdersInString(template, args) {
    return template.replace(/\${input_(\d+)}/g, (_, index) => args[parseInt(index)] || '');
}
function replacePlaceholdersInObject(obj, args) {
    if (typeof obj === 'string') {
        return replacePlaceholdersInString(obj, args);
    }
    if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    const objCopy = { ...obj };
    const stack = [];
    for (const k in objCopy) {
        stack.push({ parent: objCopy, key: k, value: objCopy[k] });
    }
    while (stack.length > 0) {
        const { parent, key, value } = stack.pop();
        let newValue;
        if (typeof value === 'string') {
            newValue = replacePlaceholdersInString(value, args);
        }
        else if (typeof value === 'object' && value !== null) {
            newValue = Array.isArray(value) ? [] : {};
        }
        else {
            newValue = value;
        }
        parent[key] = newValue;
        if (typeof value !== 'object' || value === null)
            continue;
        for (const k in value) {
            stack.push({ parent: newValue, key: k, value: value[k] });
        }
    }
    return objCopy;
}
function CreateCallServiceCommand(ctx, CallServiceYaml, HaWsClinet) {
    const { command, domain, service, service_data, target, return_response, responsepath } = CallServiceYaml;
    ctx.command(`${command}`, { hidden: true, authority: 3 })
        .action(({ session }, ...args) => {
        if (responsepath) {
            let isOk = false;
            const dispose = ctx.on('haluna/event', (data) => {
                ctx.setTimeout(() => {
                    dispose();
                    if (isOk)
                        return;
                    HaWsClinet.HaLogger('error ', command, ' Timeout');
                    session.send('Timeout');
                }, HaWsClinet.GetTimeOut() * 1000);
                if (data.type !== responsepath.type)
                    return;
                const response = searchObjectByPath(data, responsepath.path);
                if (!response)
                    return;
                isOk = true;
                session.send(response);
                dispose();
            });
        }
        HaWsClinet.CallService(replacePlaceholdersInObject(domain, args), replacePlaceholdersInObject(service, args), replacePlaceholdersInObject(service_data, args), {
            entity_id: replacePlaceholdersInObject(target.entity_id, args)
        }, return_response);
    });
}
exports.CreateCallServiceCommand = CreateCallServiceCommand;
function searchObjectByPath(obj, path) {
    const keys = path.split(':').reduce((acc, key) => {
        const arrayMatch = key.match(/(.+)\[(\d+)\]/);
        if (arrayMatch) {
            acc.push(arrayMatch[1], parseInt(arrayMatch[2]));
        }
        else {
            acc.push(key);
        }
        return acc;
    }, []);
    let current = obj;
    for (const key of keys) {
        if (current === undefined || current === null)
            return undefined;
        current = current[key];
    }
    return current;
}
exports.searchObjectByPath = searchObjectByPath;
