import { ApiGatewayManagementApi } from 'aws-sdk'

export class InvoiceWSService {
  private apiwManagementApi: ApiGatewayManagementApi

  constructor(apiwManagementApi: ApiGatewayManagementApi) {
    this.apiwManagementApi = apiwManagementApi
  }

  async sendData(connectionId: string, data: string): Promise<boolean> {
    try {
      await this.apiwManagementApi.getConnection({
        ConnectionId: connectionId
      }).promise()
      await this.apiwManagementApi.postToConnection({
        ConnectionId: connectionId,
        Data: data
      }).promise()
      return true
    } catch (error) {
      console.log("Error", error)
      return false
    }


  }
}