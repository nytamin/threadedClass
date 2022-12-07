const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

(async () => {

    const packageJSON = require('../package.json')

    let electronVersions = ['15', '17', '20', '22']
    let threadedClassVersion = packageJSON.version

    const argThreadedVersion = process.argv[2]
    if (argThreadedVersion) threadedClassVersion = argThreadedVersion

    for (const electronVersion of electronVersions) {

        console.log(`=================================================================================`)
        console.log(`Running test with threadedClass version "${threadedClassVersion}" and electron version "${electronVersion}"`)

        const testPath = path.resolve('./electron-test')

        const testPackagePath = path.join(testPath, 'package.json')
        const testPackageJSON = JSON.parse(await fs.promises.readFile(testPackagePath))

        testPackageJSON.dependencies.threadedclass = threadedClassVersion
        testPackageJSON.devDependencies.electron = electronVersion

        await fs.promises.writeFile(testPackagePath, JSON.stringify(testPackageJSON, null, 2))

        console.log('Starting tests...')


        await execAsync('yarn install', testPath, true)

        await execAsync('yarn test:vanilla', testPath)

        await execAsync('yarn test:electron', testPath)

        await execAsync('yarn electron-compile', testPath, true)
        await execAsync('yarn test:electron-compiled', testPath)





    }

})()
.then(() => {
	console.log('Done successfully!')
	process.exit(0)
})
.catch(error => {
    console.error(error)
    process.exit(1)
})

function execAsync(cmd, cwd, supressStdOut) {
    return new Promise((resolve, reject) => {

        console.log(cmd)
        const child = spawn(cmd, { cwd, shell: true })

        child.stdout.on("data", data => {
            data = `${data}`.trimEnd()
            if (!supressStdOut && data) console.log(`   stdout: ${data}`)
        });
        child.stderr.on("data", data => {
            data = `${data}`.trimEnd()
            console.log(`   stderr: ${data}`)
        });
        child.on('error', (error) => {
            reject(error)
        });
        child.on("close", code => {
            if (code === 0) resolve()
            else reject(`Exited with code ${code}`)
        });
    })
}
