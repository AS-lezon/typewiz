class NestError extends Error {}

interface IKey {
    filename: string;
    pos: number;
    opts: any;
}

export function getTypeName(value: any, nest = 0): string | null {
    if (nest === 5) {
        throw new NestError('NestError');
    }
    if (value === null) {
        return 'null';
    }
    if (['undefined', 'number', 'string', 'boolean'].indexOf(typeof value) >= 0) {
        return typeof value;
    }
    if (value instanceof Array) {
        const itemTypes = Array.from(new Set(value.map((v) => getTypeName(v, nest + 1)))).filter((t) => t !== null);
        if (itemTypes.length === 0) {
            return null;
        }
        if (itemTypes.length === 1) {
            return itemTypes[0] + '[]';
        }
        return `Array<${itemTypes.sort().join('|')}>`;
    }
    if (value instanceof Function) {
        let argsStr: string = value.toString().split('=>')[0];

        // make sure argsStr is in a form of (arg1,arg2) for the following cases
        // fn = a => 3
        // fn = (a) => 3
        // function fn(a) { return 3 }

        argsStr = argsStr.includes('(') ? (argsStr.match(/\(.*?\)/gi) || '()')[0] : `(${argsStr})`;
        const args: string[] = argsStr
            .replace(/[()]/g, '')
            .split(',')
            .filter((e: string) => e !== '');

        const typedArgs = args.map((arg) => {
            let [name] = arg.split('=');
            name = name.trim();

            if (name.includes('[')) {
                const nakedName = name.replace(/\[|\]/gi, '').trim();
                name = `${nakedName}Array`;
                return `${name}: any`;
            }
            if (name.includes('{')) {
                const nakedName = name.replace(/\{|\}/gi, '').trim();
                name = `${nakedName}Object: {${nakedName}: any}`;
                return `${name}`;
            }
            if (name.includes('...')) {
                name = `${name}Array: any[]`;
                return `${name}`;
            }

            return `${name}: any`;
        });

        return `(${typedArgs}) => any`;
    }
    if (value.constructor && value.constructor.name) {
        const { name } = value.constructor;
        return name === 'Object' ? 'object' : name;
    }

    return typeof value;
}

const logs: { [key: string]: Set<string> } = {};
const trackedObjects = new WeakMap<object, [string, number]>();

export function $_$twiz(name: string, value: any, pos: number, filename: string, opts: any) {
    const objectDeclaration = trackedObjects.get(value);
    const index = JSON.stringify({ filename, pos, opts } as IKey);
    try {
        const typeName = getTypeName(value);
        if (!logs[index]) {
            logs[index] = new Set();
        }
        const typeSpec = JSON.stringify([typeName, objectDeclaration]);
        logs[index].add(typeSpec);
    } catch (e) {
        if (e instanceof NestError) {
            // simply ignore the type
        }
        throw e;
    }
}

// tslint:disable:no-namespace
export namespace $_$twiz {
    export const typeName = getTypeName;
    export const get = () => {
        return Object.keys(logs).map((key) => {
            const { filename, pos, opts } = JSON.parse(key) as IKey;
            const typeOptions = Array.from(logs[key]).map((v) => JSON.parse(v));
            return [filename, pos, typeOptions, opts] as [string, number, string[], any];
        });
    };
    export const track = (v: any, p: number, f: string) => {
        if (v && (typeof v === 'object' || typeof v === 'function')) {
            trackedObjects.set(v, [f, p]);
        }
        return v;
    };
}
