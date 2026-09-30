export const handler = async (event) => {

    console.log("Lambda triggered!");

    console.log(
        JSON.stringify(event, null, 2)
    );

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: "Lambda is working!"
        })
    };
};